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
  const fullMatch = address.match(/\b([A-Z]{1,2})\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i);
  if (fullMatch) return fullMatch[1].toUpperCase();

  // Partial postcode at end of string
  const partialMatch = address.match(/\b([A-Z]{1,2})\d{1,2}[A-Z]?\b\s*$/i);
  if (partialMatch) return partialMatch[1].toUpperCase();

  // Just try to find any postcode-like pattern anywhere
  const anyMatch = address.match(/\b([A-Z]{1,2})\d/i);
  if (anyMatch) return anyMatch[1].toUpperCase();

  return null;
}

// Extract move summary from ai_analysis JSONB
function extractAiSummary(aiAnalysis: any) {
  if (!aiAnalysis) return { estimate: null, volumeM3: null, vans: null, movers: null, distanceMiles: null };

  // Try top-level fields first (in case AI returns them)
  let estimate = aiAnalysis.estimated_cost || null;
  let volumeM3 = aiAnalysis.total_volume_m3 || null;
  let vans = aiAnalysis.vans_needed || null;
  let movers = aiAnalysis.movers_recommended || null;
  let distanceMiles = aiAnalysis.distance_miles || null;

  // If no top-level volume, calculate from items
  if (!volumeM3 && aiAnalysis.items && Array.isArray(aiAnalysis.items)) {
    let totalFt3 = 0;
    for (const item of aiAnalysis.items) {
      // Try volume_m3 field
      if (item.volume_m3) {
        totalFt3 += (item.volume_m3 * 35.3147) * (item.quantity || 1); // convert m³ to ft³ for consistency
        continue;
      }
      // Parse from note field like "~25 ft³"
      const noteStr = item.note || item.notes || '';
      const match = noteStr.match(/([\d.]+)\s*ft/i);
      if (match) {
        totalFt3 += parseFloat(match[1]) * (item.quantity || 1);
      }
    }

    if (totalFt3 > 0) {
      volumeM3 = Math.round(totalFt3 * 0.0283168 * 10) / 10; // ft³ to m³
    }
  }

  // Estimate vans from volume if not provided (~35 m³ per transit van)
  if (!vans && volumeM3) {
    vans = Math.ceil(volumeM3 / 35);
  }

  // Estimate movers if not provided
  if (!movers && vans) {
    movers = vans >= 2 ? 3 : 2;
  }

  return { estimate, volumeM3, vans, movers, distanceMiles };
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
      return NextResponse.json({
        distributed_to: 0,
        fallback: true,
        message: 'Could not extract postcode — admin notified',
      });
    }

    // 3. Extract AI summary from ai_analysis JSONB
    const aiSummary = extractAiSummary(quote.ai_analysis);
    console.log(`[MOVCO] 🤖 AI Summary — Est: £${aiSummary.estimate || '?'}, Vol: ${aiSummary.volumeM3 || '?'} m³, Vans: ${aiSummary.vans || '?'}, Movers: ${aiSummary.movers || '?'}`);

    // 4. Get current lead price
    const { data: pricing } = await supabase
      .from('lead_pricing')
      .select('lead_cost_pence')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const leadCost = pricing?.lead_cost_pence || 500; // Default £5.00

    console.log(`[MOVCO] 💰 Lead cost: £${(leadCost / 100).toFixed(2)}`);

    // 5. Find matching active companies with enough balance
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

    // 6. Get customer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', quote.user_id)
      .single();

    // 7. Distribute to each matching company
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

      // Record lead purchase with full details extracted from ai_analysis
      await supabase.from('lead_purchases').insert({
        company_id: company.id,
        quote_id: quote.id,
        amount_charged_pence: leadCost,
        customer_name: profile?.full_name || null,
        customer_email: profile?.email || null,
        customer_phone: profile?.phone || null,
        from_postcode: quote.starting_address,
        to_postcode: quote.ending_address,
        distance: aiSummary.distanceMiles ? `${aiSummary.distanceMiles} miles` : null,
        estimated_quote: aiSummary.estimate ? `£${aiSummary.estimate.toLocaleString()}` : null,
        volume: aiSummary.volumeM3 ? `${aiSummary.volumeM3} m³` : null,
        vans: aiSummary.vans ? `${aiSummary.vans} van${aiSummary.vans > 1 ? 's' : ''}` : null,
        movers: aiSummary.movers ? `${aiSummary.movers}` : null,
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
