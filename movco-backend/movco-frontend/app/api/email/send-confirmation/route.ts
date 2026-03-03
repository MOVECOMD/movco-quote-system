import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function buildConfirmationEmail({
  companyName,
  companyEmail,
  companyPhone,
  customerName,
  recipientEmail,
  eventType,
  eventDate,
  eventTime,
  eventEndTime,
  location,
  description,
}: {
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  customerName: string;
  recipientEmail: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  eventEndTime?: string;
  location?: string;
  description?: string;
}): { subject: string; html: string } {
  const typeLabels: Record<string, string> = {
    job: 'Moving Day',
    survey: 'Home Survey',
    callback: 'Callback',
    delivery: 'Delivery',
    other: 'Appointment',
  };

  const typeLabel = typeLabels[eventType] || typeLabels.other;
  const subject = `${typeLabel} Confirmation — ${eventDate}`;

  const timeDisplay = eventEndTime ? `${eventTime} – ${eventEndTime}` : eventTime;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e40af, #4f46e5); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">${companyName}</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">${typeLabel} Confirmed ✓</p>
    </div>

    <!-- Body -->
    <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">Hi ${customerName},</p>
      
      <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">
        Your <strong>${typeLabel.toLowerCase()}</strong> has been confirmed. Here are the details:
      </p>

      <!-- Appointment Details Card -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 0 0 24px;">
        
        <div style="display: flex; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; background: #dbeafe; border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px; flex-shrink: 0;">📅</div>
          <div style="margin-left: 12px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: 600;">Date</p>
            <p style="color: #111827; font-size: 16px; margin: 4px 0 0; font-weight: 600;">${eventDate}</p>
          </div>
        </div>

        <div style="display: flex; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; background: #dbeafe; border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px; flex-shrink: 0;">🕐</div>
          <div style="margin-left: 12px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: 600;">Time</p>
            <p style="color: #111827; font-size: 16px; margin: 4px 0 0; font-weight: 600;">${timeDisplay}</p>
          </div>
        </div>

        <div style="display: flex; margin-bottom: ${description ? '16px' : '0'};">
          <div style="width: 40px; height: 40px; background: #dbeafe; border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px; flex-shrink: 0;">📍</div>
          <div style="margin-left: 12px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: 600;">Location</p>
            <p style="color: #111827; font-size: 16px; margin: 4px 0 0; font-weight: 600;">${location || 'To be confirmed'}</p>
          </div>
        </div>

        ${description ? `
        <div style="display: flex;">
          <div style="width: 40px; height: 40px; background: #dbeafe; border-radius: 10px; text-align: center; line-height: 40px; font-size: 18px; flex-shrink: 0;">📝</div>
          <div style="margin-left: 12px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: 600;">Notes</p>
            <p style="color: #374151; font-size: 14px; margin: 4px 0 0;">${description}</p>
          </div>
        </div>
        ` : ''}
      </div>

      <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
        If you need to reschedule or have any questions, please don't hesitate to get in touch.
      </p>

      <!-- Contact Info -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
        <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 8px;">${companyName}</p>
        ${companyPhone ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 4px;">📱 ${companyPhone}</p>` : ''}
        ${companyEmail ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">✉️ ${companyEmail}</p>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">This email was sent by ${companyName} via MOVCO</p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

function createRawEmail(from: string, to: string, subject: string, html: string): string {
  const boundary = 'boundary_' + Date.now();
  const rawEmail = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');

  // Gmail API requires URL-safe base64
  return Buffer.from(rawEmail)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      company_id,
      recipient_email,
      recipient_name,
      event_type,
      event_title,
      start_time,
      end_time,
      location,
      description,
      event_id,
    } = body;

    if (!company_id || !recipient_email) {
      return NextResponse.json({ error: 'company_id and recipient_email are required' }, { status: 400 });
    }

    // Get email connection for this company
    const { data: connection, error: connError } = await supabaseAdmin
      .from('email_connections')
      .select('*')
      .eq('company_id', company_id)
      .eq('provider', 'gmail')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ error: 'No email connected. Please connect Gmail in Settings.' }, { status: 400 });
    }

    // Get company details
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name, email, phone')
      .eq('id', company_id)
      .single();

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        // Mark connection as broken
        await supabaseAdmin
          .from('email_connections')
          .delete()
          .eq('id', connection.id);
        return NextResponse.json({ error: 'Gmail connection expired. Please reconnect in Settings.' }, { status: 401 });
      }

      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from('email_connections')
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
    }

    // Format date and time
    const startDate = new Date(start_time);
    const eventDate = startDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const eventTime = startDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const eventEndTime = end_time
      ? new Date(end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : undefined;

    // Build email
    const { subject, html } = buildConfirmationEmail({
      companyName: company?.name || 'Moving Company',
      companyEmail: company?.email || undefined,
      companyPhone: company?.phone || undefined,
      customerName: recipient_name || 'there',
      recipientEmail: recipient_email,
      eventType: event_type || 'other',
      eventDate,
      eventTime,
      eventEndTime,
      location: location || undefined,
      description: description || undefined,
    });

    // Create raw email and send via Gmail API
    const rawMessage = createRawEmail(
      connection.email_address,
      recipient_email,
      subject,
      html
    );

    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    if (!gmailResponse.ok) {
      const errData = await gmailResponse.text();
      console.error('Gmail send failed:', errData);

      // Log the failure
      await supabaseAdmin.from('email_logs').insert({
        company_id,
        recipient_email,
        recipient_name,
        subject,
        email_type: 'appointment_confirmation',
        event_id: event_id || null,
        status: 'failed',
        error_message: errData,
      });

      return NextResponse.json({ error: 'Failed to send email via Gmail' }, { status: 500 });
    }

    // Log success
    await supabaseAdmin.from('email_logs').insert({
      company_id,
      recipient_email,
      recipient_name,
      subject,
      email_type: 'appointment_confirmation',
      event_id: event_id || null,
      status: 'sent',
    });

    return NextResponse.json({ success: true, subject });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}