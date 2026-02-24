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

  // ============================================
  // CHECKOUT SESSION COMPLETED
  // ============================================
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

    // ============================================
    // HANDLE: CRM Subscription
    // ============================================
    if (paymentType === 'crm_subscription') {
      const companyId = session.metadata?.company_id;
      const subscriptionId = session.subscription as string;

      if (!companyId) {
        console.error('Missing company_id in CRM subscription metadata');
        return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
      }

      console.log(`[MOVCO] Processing CRM subscription for company ${companyId}`);

      // Get subscription details from Stripe for period dates
      let periodStart: string | null = null;
      let periodEnd: string | null = null;

      if (subscriptionId) {
        try {
          const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
          periodStart = new Date(sub.current_period_start * 1000).toISOString();
          periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        } catch (err) {
          console.error('Failed to retrieve subscription details:', err);
        }
      }

      // Upsert CRM subscription record
      const { data: existing } = await supabase
        .from('crm_subscriptions')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from('crm_subscriptions')
          .update({
            status: 'active',
            stripe_subscription_id: subscriptionId,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId);

        if (updateError) {
          console.error('Failed to update CRM subscription:', updateError);
          return NextResponse.json({ error: 'Subscription update failed' }, { status: 500 });
        }

        console.log(`[MOVCO] ✅ CRM subscription reactivated for company ${companyId}`);
      } else {
        const { error: insertError } = await supabase
          .from('crm_subscriptions')
          .insert({
            company_id: companyId,
            status: 'active',
            stripe_subscription_id: subscriptionId,
            current_period_start: periodStart,
            current_period_end: periodEnd,
          });

        if (insertError) {
          console.error('Failed to insert CRM subscription:', insertError);
          return NextResponse.json({ error: 'Subscription insert failed' }, { status: 500 });
        }

        console.log(`[MOVCO] ✅ CRM subscription created for company ${companyId}`);
      }

      // Seed default pipeline stages (only if none exist yet)
      const { data: existingStages } = await supabase
        .from('crm_pipeline_stages')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);

      if (!existingStages || existingStages.length === 0) {
        const defaultStages = [
          { company_id: companyId, name: 'New Lead', color: '#6366F1', position: 0 },
          { company_id: companyId, name: 'Contacted', color: '#F59E0B', position: 1 },
          { company_id: companyId, name: 'Quote Sent', color: '#3B82F6', position: 2 },
          { company_id: companyId, name: 'Booked', color: '#10B981', position: 3 },
          { company_id: companyId, name: 'Completed', color: '#059669', position: 4 },
          { company_id: companyId, name: 'Lost', color: '#EF4444', position: 5 },
        ];

        const { error: stagesError } = await supabase
          .from('crm_pipeline_stages')
          .insert(defaultStages);

        if (stagesError) {
          console.error('Failed to seed pipeline stages:', stagesError);
        } else {
          console.log(`[MOVCO] ✅ Default pipeline stages created for company ${companyId}`);
        }
      }

      return NextResponse.json({ received: true });
    }
  }

  // ============================================
  // SUBSCRIPTION UPDATED (renewal, payment changes)
  // ============================================
  if (event.type === 'customer.subscription.updated') {
    const subscription: any = event.data.object;
    const status = subscription.status;

    // Find the CRM subscription by stripe_subscription_id
    const { data: crmSub } = await supabase
      .from('crm_subscriptions')
      .select('id, company_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();

    if (crmSub) {
      const mappedStatus = status === 'active' ? 'active'
        : status === 'past_due' ? 'past_due'
        : status === 'canceled' ? 'canceled'
        : 'inactive';

      const { error } = await supabase
        .from('crm_subscriptions')
        .update({
          status: mappedStatus,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', crmSub.id);

      if (error) {
        console.error('Failed to update subscription status:', error);
      } else {
        console.log(`[MOVCO] ✅ CRM subscription ${subscription.id} updated to ${mappedStatus}`);
      }
    }
  }

  // ============================================
  // SUBSCRIPTION DELETED (canceled or expired)
  // ============================================
  if (event.type === 'customer.subscription.deleted') {
    const subscription: any = event.data.object;

    const { error } = await supabase
      .from('crm_subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Failed to cancel subscription:', error);
    } else {
      console.log(`[MOVCO] ✅ CRM subscription ${subscription.id} canceled`);
    }
  }

  return NextResponse.json({ received: true });
}
