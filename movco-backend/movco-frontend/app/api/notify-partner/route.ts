// app/api/notify-partner/route.ts
// Sends email notifications to partners when a new lead comes in

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildStorageLeadEmail, buildRemovalsLeadEmail } from '@/app/lib/emailTemplates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { partner_id, product_type, lead_data } = body;

    if (!partner_id || !product_type || !lead_data) {
      return NextResponse.json(
        { error: 'Missing required fields: partner_id, product_type, lead_data' },
        { status: 400 }
      );
    }

    // Look up the partner to get their email
    const table = product_type === 'storage' ? 'storage_partners' : 'removals_partners';

    const { data: partner, error: partnerError } = await supabase
      .from(table)
      .select('company_name, email, notification_email')
      .eq('id', partner_id)
      .single();

    if (partnerError || !partner) {
      console.error('Partner lookup failed:', partnerError);
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Use notification_email if set, otherwise fall back to main email
    const recipientEmail = partner.notification_email || partner.email;

    if (!recipientEmail) {
      console.error('No email address found for partner:', partner_id);
      return NextResponse.json(
        { error: 'Partner has no email address configured' },
        { status: 400 }
      );
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const customerName = lead_data.customer_name || lead_data.name || 'Unknown';

    let html: string;

    if (product_type === 'storage') {
      html = buildStorageLeadEmail({
        partnerName: partner.company_name,
        customerName,
        customerEmail: lead_data.customer_email || lead_data.email || '',
        customerPhone: lead_data.customer_phone || lead_data.phone || '',
        storageRequirements: lead_data.storage_requirements || lead_data.requirements || 'Not specified',
        recommendedUnit: lead_data.recommended_unit || lead_data.unit_name || 'Not specified',
        quotedPrice: lead_data.quoted_price || lead_data.price || '—',
        date: dateStr,
      });
    } else {
      // Removals
      html = buildRemovalsLeadEmail({
        partnerName: partner.company_name,
        customerName,
        customerEmail: lead_data.customer_email || lead_data.email || '',
        customerPhone: lead_data.customer_phone || lead_data.phone || '',
        movingFrom: lead_data.moving_from || lead_data.from_address || 'Not specified',
        movingTo: lead_data.moving_to || lead_data.to_address || 'Not specified',
        items: lead_data.items || [],
        vanSize: lead_data.van_size || lead_data.van_type || 'Not specified',
        crewSize: lead_data.crew_size || lead_data.crew || 2,
        estimatedTime: lead_data.estimated_time || lead_data.duration || 'Not specified',
        quotedPrice: lead_data.quoted_price || lead_data.price || '—',
        photoUrls: lead_data.photo_urls || lead_data.photos || [],
        date: dateStr,
      });
    }

    // Send the email via Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'MOVCO Leads <leads@movco.co.uk>',
      to: recipientEmail,
      subject: `New Quote Request — ${customerName} — ${now.toLocaleDateString('en-GB')}`,
      html,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return NextResponse.json(
        { error: 'Failed to send email', details: emailError },
        { status: 500 }
      );
    }

    console.log(`✅ Lead notification sent to ${recipientEmail} for partner ${partner.company_name}`);

    return NextResponse.json({
      success: true,
      email_id: emailResult?.id,
      sent_to: recipientEmail,
    });
  } catch (err: any) {
    console.error('Notification route error:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
