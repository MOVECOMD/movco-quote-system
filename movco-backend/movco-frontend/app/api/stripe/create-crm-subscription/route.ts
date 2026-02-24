import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: NextRequest) {
  try {
    const { company_id, company_email, company_name } = await req.json();

    if (!company_id) {
      return NextResponse.json({ error: 'company_id required' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: company_email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'MOVCO CRM Pro',
              description: 'Pipeline management, diary scheduling, customer database & reporting',
            },
            unit_amount: 12999, // £129.99
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        company_id,
        type: 'crm_subscription',
      },
      success_url: `${req.nextUrl.origin}/company-dashboard?crm=activated`,
      cancel_url: `${req.nextUrl.origin}/company-dashboard?crm=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('CRM subscription checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
