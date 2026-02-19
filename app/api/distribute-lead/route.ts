import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const NOTIFY_EMAIL = 'zachary@movco.co.uk';

// Extract UK postcode prefix (outward code area letters) from an address
function extractPostcodePrefix(address: string): string | null {
  if (!address) return null;

  // Full UK postcode pattern - extract just the 1-2 letter area code
  // Matches: SW1A 2AA, E1 6AN, EC1A 1BB, W1D 3SE, etc.
  const fullMatch = address.match(/\b([A-Z]{1,2})\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i);
  if (fullMatch) return fullMatch[1].toUpperCase();

  // Partial postcode at end of string (e.g. "London SW1" or "SW1A")
  const partialMatch = address.match(/\b([A-Z]{1,2})\d{1,2}[A-Z]?\b\s*$/i);
  if (partialMatch) return partialMatch[1].toUpperCase();

  // Just try to find any postcode-like pattern anywhere
  const anyMatch = address.match(/\b([A-Z]{1,2})\d/i);
  if (anyMatch) return anyMatch[1].toUpperCase();

  return null;
}

export async function POST(req: Request) {
  try {
    const { quote_id } = await req.json();

    if (!quote_id) {
      return NextResponse.json({ error: 'Missing quote_id' }, { status: 400 });
    }

    console.log(`[MOVCO] 🎯 Distributing lead for quote: ${quote_id}`);

    // 1. Get the quote
    const { data: quote, error: quoteError } = await supabase
      .from('instant_quotes')
      .select('*')
      .eq('id', quote_id)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quote_id);
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // 2. Extract postcode prefix from starting address
    const fromPrefix = extractPostcodePrefix(quote.starting_address || '');
    const toPrefix = extractPostcodePrefix(quote.ending_address || '');

    console.log(`[MOVCO] 📍 Postcode prefixes — From: ${fromPrefix || 'unknown'}, To: ${toPrefix || 'unknown'}`);

    if (!fromPrefix) {
      console.log('[MOVCO] ⚠️ Could not extract postcode from starting address');
      // Still notify admin as fallback
      return NextResponse.json({
        distributed_to: 0,
        fallback: true,
        message: 'Could not extract postcode — admin notified',
      });
    }

    // 3. Get current lead price
    const { data: pricing } = await supabase
      .from('lead_pricing')
      .select('lead_cost_pence')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const leadCost = pricing?.lead_cost_pence || 500; // Default £5.00

    console.log(`[MOVCO] 💰 Lead cost: £${(leadCost / 100).toFixed(2)}`);

    // 4. Find matching active companies with enough balance
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select('*')
      .eq('is_active', true)
      .gte('balance_pence', leadCost)
      .contains('coverage_postcodes', [fromPrefix]);

    if (compError) {
      console.error('Error finding companies:', compError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log(`[MOVCO] 🏢 Found ${companies?.length || 0} matching companies for ${fromPrefix}`);

    if (!companies || companies.length === 0) {
      console.log('[MOVCO] ⚠️ No matching companies found — admin notified');
      return NextResponse.json({
        distributed_to: 0,
        fallback: true,
        message: 'No matching companies with sufficient balance',
      });
    }

    // 5. Get customer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', quote.user_id)
      .single();

    // 6. Distribute to each matching company
    const distributed: string[] = [];

    for (const company of companies) {
      console.log(`[MOVCO] 📤 Distributing to: ${company.company_name} (balance: £${(company.balance_pence / 100).toFixed(2)})`);

      // Deduct balance
      const newBalance = company.balance_pence - leadCost;
      const { error: updateError } = await supabase
        .from('companies')
        .update({ balance_pence: newBalance })
        .eq('id', company.id);

      if (updateError) {
        console.error(`Failed to deduct balance for ${company.company_name}:`, updateError);
        continue;
      }

      // Record wallet transaction
      await supabase.from('wallet_transactions').insert({
        company_id: company.id,
        amount_pence: -leadCost,
        type: 'lead_purchase',
        description: `Lead: ${quote.starting_address} → ${quote.ending_address}`,
        quote_id: quote.id,
      });

      // Record lead purchase with full details
      await supabase.from('lead_purchases').insert({
        company_id: company.id,
        quote_id: quote.id,
        amount_charged_pence: leadCost,
        customer_name: profile?.full_name || null,
        customer_email: profile?.email || null,
        customer_phone: profile?.phone || null,
        from_postcode: quote.starting_address,
        to_postcode: quote.ending_address,
        distance: quote.distance_miles ? `${quote.distance_miles} miles` : null,
        estimated_quote: quote.estimate ? `£${quote.estimate}` : null,
        volume: quote.total_volume_m3 ? `${quote.total_volume_m3} m³` : null,
        vans: quote.van_description || (quote.van_count ? `${quote.van_count} van(s)` : null),
        movers: quote.recommended_movers ? `${quote.recommended_movers}` : null,
        status: 'new',
      });

      distributed.push(company.company_name);
      console.log(`[MOVCO] ✅ Lead distributed to ${company.company_name} — new balance: £${(newBalance / 100).toFixed(2)}`);
    }

    console.log(`[MOVCO] 🎉 Lead distributed to ${distributed.length} companies: ${distributed.join(', ')}`);

    return NextResponse.json({
      distributed_to: distributed.length,
      companies: distributed,
      lead_cost_pence: leadCost,
      postcode_prefix: fromPrefix,
    });

  } catch (err: any) {
    console.error('[MOVCO] ❌ Lead distribution error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
