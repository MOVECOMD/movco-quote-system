import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { company_id, amount_pence } = await req.json();

    if (!company_id || !amount_pence || amount_pence < 500) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get company record
    const { data: company, error: compError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (compError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Create or reuse Stripe customer
    let stripeCustomerId = company.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: company.email,
        name: company.company_name,
        metadata: { company_id: company.id },
      });
      stripeCustomerId = customer.id;

      await supabase
        .from('companies')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', company.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'MOVCO Lead Balance Top Up',
              description: `Add £${(amount_pence / 100).toFixed(2)} to your lead wallet`,
            },
            unit_amount: amount_pence,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/company-dashboard?topup=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/company-dashboard?topup=cancelled`,
      metadata: {
        company_id: company.id,
        amount_pence: amount_pence.toString(),
        type: 'wallet_topup',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
