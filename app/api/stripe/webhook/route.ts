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

    // Only process wallet top-ups
    if (session.metadata?.type !== 'wallet_topup') {
      return NextResponse.json({ received: true });
    }

    const companyId = session.metadata?.company_id;
    const amountPence = parseInt(session.metadata?.amount_pence || '0');

    if (!companyId || amountPence <= 0) {
      console.error('Missing metadata in checkout session');
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    console.log(`[MOVCO] Processing top-up: £${(amountPence / 100).toFixed(2)} for company ${companyId}`);

    // Get current balance
    const { data: company, error: fetchError } = await supabase
      .from('companies')
      .select('balance_pence, company_name')
      .eq('id', companyId)
      .single();

    if (fetchError || !company) {
      console.error('Company not found:', companyId);
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Credit the balance
    const newBalance = company.balance_pence + amountPence;

    const { error: updateError } = await supabase
      .from('companies')
      .update({ balance_pence: newBalance })
      .eq('id', companyId);

    if (updateError) {
      console.error('Failed to update balance:', updateError);
      return NextResponse.json({ error: 'Balance update failed' }, { status: 500 });
    }

    // Record wallet transaction
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

  return NextResponse.json({ received: true });
}
