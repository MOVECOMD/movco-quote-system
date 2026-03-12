import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildWelcomeEmail } from '@/app/lib/emailTemplates';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // ============================================
    // HANDLE: Payment Link — Partner Subscription
    // (No metadata.type = came from a Stripe Payment Link)
    // ============================================
    if (!paymentType) {
      const customerEmail = session.customer_details?.email?.toLowerCase().trim();
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string | null;

      if (!customerEmail) {
        console.log('[MOVCO] Payment link checkout with no email — ignoring');
        return NextResponse.json({ received: true });
      }

      // Retrieve line items to determine what they bought
      let lineItems;
      try {
        lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ['data.price.product'],
        });
      } catch (err) {
        console.error('[MOVCO] Failed to retrieve line items:', err);
        return NextResponse.json({ received: true, warning: 'Could not retrieve line items' });
      }

      let plan: string | null = null;
      let productType: 'storage' | 'calculator' | 'crm' | null = null;
      let productLabel = '';
      let monthlyPrice = '';
      let includesInstallation = false;

      for (const item of lineItems.data) {
        const product = item.price?.product as Stripe.Product;
        const productName = product?.name?.toLowerCase() || '';
        const isRecurring = item.price?.type === 'recurring';

        if (!isRecurring) {
          // One-time charge — check if it's the installation upsell
          if (productName.includes('install')) {
            includesInstallation = true;
          }
          continue;
        }

        // Determine plan from the recurring product name
        if (productName.includes('crm')) {
          plan = 'crm_pro';
          productType = 'crm';
          productLabel = 'Removals CRM Pro';
          monthlyPrice = '£149.99';
        } else if (productName.includes('removals') || productName.includes('removal')) {
          plan = 'calculator';
          productType = 'calculator';
          productLabel = 'Removals Calculator';
          monthlyPrice = '£99.99';
        } else if (productName.includes('storage')) {
          plan = 'calculator';
          productType = 'storage';
          productLabel = 'Storage Calculator';
          monthlyPrice = '£99.99';
        }
      }

      // If we couldn't identify a partner product, it might be a different checkout — skip
      if (!plan || !productType) {
        console.log('[MOVCO] Payment link checkout but could not match a partner product — ignoring');
        return NextResponse.json({ received: true });
      }

      console.log(`[MOVCO] 📦 Payment Link: ${productLabel} | Plan: ${plan} | Installation: ${includesInstallation} | Email: ${customerEmail}`);

      // Find the partner by email
      let partner: any = null;
      let partnerTable: string;

      if (productType === 'storage') {
        partnerTable = 'storage_partners';
        const { data } = await supabase
          .from('storage_partners')
          .select('*')
          .eq('email', customerEmail)
          .maybeSingle();
        partner = data;
      } else {
        partnerTable = 'removals_partners';
        const { data } = await supabase
          .from('removals_partners')
          .select('*')
          .eq('email', customerEmail)
          .maybeSingle();
        partner = data;
      }

      if (!partner) {
        console.error(`[MOVCO] ⚠️ Partner not found with email: ${customerEmail} in ${partnerTable}. Manual activation needed.`);
        return NextResponse.json({
          received: true,
          warning: `No partner found with email ${customerEmail}. Manual activation needed.`,
        });
      }

      // Activate partner + save Stripe IDs
      const { error: updateError } = await supabase
        .from(partnerTable)
        .update({
          active: true,
          plan,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        })
        .eq('id', partner.id);

      if (updateError) {
        console.error('[MOVCO] Failed to update partner:', updateError);
        return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
      }

      console.log(`[MOVCO] ✅ Partner activated: ${partner.company_name} (${customerEmail})`);

      // Send welcome email (fire-and-forget)
      try {
        const calculatorUrl = productType === 'storage'
          ? `https://movco-quote-system.vercel.app/storage/${partner.slug}`
          : productType === 'calculator'
          ? `https://movco-quote-system.vercel.app/removals/${partner.slug}`
          : `https://movco-quote-system.vercel.app/company-dashboard`;

        const html = buildWelcomeEmail({
          companyName: partner.company_name,
          contactName: partner.company_name,
          productLabel,
          monthlyPrice,
          calculatorUrl,
          slug: partner.slug,
          includesInstallation,
        });

        await resend.emails.send({
          from: 'MOVCO <welcome@movco.co.uk>',
          to: customerEmail,
          subject: `Welcome to MOVCO — ${productLabel} is Live! 🚀`,
          html,
        });

        console.log(`[MOVCO] 📧 Welcome email sent to ${customerEmail}`);
      } catch (emailErr) {
        console.error('[MOVCO] Failed to send welcome email:', emailErr);
      }

      return NextResponse.json({ received: true, activated: partner.company_name });
    }
  }

  // ============================================
  // SUBSCRIPTION UPDATED (renewal, payment changes)
  // ============================================
  if (event.type === 'customer.subscription.updated') {
    const subscription: any = event.data.object;
    const status = subscription.status;

    // Check CRM subscriptions table
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

    // Check CRM subscriptions table
    const { error: crmError } = await supabase
      .from('crm_subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    if (crmError) {
      console.error('Failed to cancel CRM subscription:', crmError);
    }

    // Also check partner tables (for payment link subscriptions)
    for (const table of ['storage_partners', 'removals_partners']) {
      const { data } = await supabase
        .from(table)
        .select('id, company_name')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle();

      if (data) {
        await supabase
          .from(table)
          .update({ active: false, plan: 'trial' })
          .eq('id', data.id);

        console.log(`[MOVCO] ⛔ Partner deactivated: ${data.company_name} (subscription cancelled)`);
        break;
      }
    }
  }

  return NextResponse.json({ received: true });
}
