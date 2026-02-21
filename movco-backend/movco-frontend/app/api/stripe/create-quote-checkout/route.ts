import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

export async function POST(req: Request) {
  try {
    const { user_id, user_email } = await req.json();

    if (!user_id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user_email || undefined,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'MOVCO Quote Pack',
              description: '5 additional AI-powered instant moving quotes',
            },
            unit_amount: 499, // £4.99 in pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/instant-quote?purchase=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/instant-quote?purchase=cancelled`,
      metadata: {
        user_id,
        type: 'quote_pack',
        credits: '5',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Quote pack checkout error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}