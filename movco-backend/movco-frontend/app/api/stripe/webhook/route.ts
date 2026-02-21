import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentType = session.metadata?.type;

    // ============================================
    // HANDLE: Quote Pack Purchase
    // ============================================
    if (paymentType === 'quote_pack') {
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || '5');

      if (!userId) {
        console.error('Missing user_id in quote pack metadata');
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
      }

      console.log(`[MOVCO] Processing quote pack: ${credits} credits for user ${userId}`);

      const { data: existing } = await supabase
        .from('user_quote_credits')
        .select('id, credits')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from('user_quote_credits')
          .update({
            credits: existing.credits + credits,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Failed to update credits:', updateError);
          return NextResponse.json({ error: 'Credit update failed' }, { status: 500 });
        }

        console.log(`[MOVCO] ✅ Credits updated: ${existing.credits} → ${existing.credits + credits}`);
      } else {
        const { error: insertError } = await supabase
          .from('user_quote_credits')
          .insert({
            user_id: userId,
            credits,
          });

        if (insertError) {
          console.error('Failed to insert credits:', insertError);
          return NextResponse.json({ error: 'Credit insert failed' }, { status: 500 });
        }

        console.log(`[MOVCO] ✅ Credits created: ${credits} for user ${userId}`);
      }

      return NextResponse.json({ received: true });
    }

    // ============================================
    // HANDLE: Company Wallet Top-Up
    // ============================================
    if (paymentType === 'wallet_topup') {
      const companyId = session.metadata?.company_id;
      const amountPence = parseInt(session.metadata?.amount_pence || '0');

      if (!companyId || amountPence <= 0) {
        console.error('Missing metadata in checkout session');
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }

      console.log(`[MOVCO] Processing top-up: £${(amountPence / 100).toFixed(2)} for company ${companyId}`);

      const { data: company, error: fetchError } = await supabase
        .from('companies')
        .select('balance_pence, company_name')
        .eq('id', companyId)
        .single();

      if (fetchError || !company) {
        console.error('Company not found:', companyId);
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }

      const newBalance = company.balance_pence + amountPence;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ balance_pence: newBalance })
        .eq('id', companyId);

      if (updateError) {
        console.error('Failed to update balance:', updateError);
        return NextResponse.json({ error: 'Balance update failed' }, { status: 500 });
      }

      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          company_id: companyId,
          amount_pence: amountPence,
          type: 'top_up',
          description: `Stripe top up: £${(amountPence / 100).toFixed(2)}`,
          stripe_session_id: session.id,
        });

      if (txError) {
        console.error('Failed to record transaction:', txError);
      }

      console.log(`[MOVCO] ✅ Balance updated for ${company.company_name}: £${(newBalance / 100).toFixed(2)}`);
    }
  }

  return NextResponse.json({ received: true });
}
