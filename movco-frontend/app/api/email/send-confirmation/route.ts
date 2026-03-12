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

type EmailTemplate = {
  header_color_from: string;
  header_color_to: string;
  greeting: string;
  body_text: string;
  closing_text: string;
  footer_text: string;
  show_phone: boolean;
  show_email: boolean;
  logo_url: string;
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  social_website: string;
  social_tiktok: string;
};

const defaultTemplate: EmailTemplate = {
  header_color_from: '#1e40af',
  header_color_to: '#4f46e5',
  greeting: 'Hi {customer_name},',
  body_text: 'Your {event_type} has been confirmed. Here are the details:',
  closing_text: "If you need to reschedule or have any questions, please don't hesitate to get in touch.",
  footer_text: 'This email was sent by {company_name} via MOVCO',
  show_phone: true,
  show_email: true,
  logo_url: '',
  social_facebook: '',
  social_instagram: '',
  social_twitter: '',
  social_website: '',
  social_tiktok: '',
};

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return result;
}

function buildConfirmationEmail({
  companyName, companyEmail, companyPhone, customerName, recipientEmail,
  eventType, eventDate, eventTime, eventEndTime, location, description, template,
}: {
  companyName: string; companyEmail?: string; companyPhone?: string; customerName: string;
  recipientEmail: string; eventType: string; eventDate: string; eventTime: string;
  eventEndTime?: string; location?: string; description?: string; template: EmailTemplate;
}): { subject: string; html: string } {
  const typeLabels: Record<string, string> = {
    job: 'Moving Day', survey: 'Home Survey', callback: 'Callback', delivery: 'Delivery', other: 'Appointment',
  };
  const typeLabel = typeLabels[eventType] || typeLabels.other;
  const subject = `${typeLabel} Confirmation — ${eventDate}`;
  const timeDisplay = eventEndTime ? `${eventTime} – ${eventEndTime}` : eventTime;

  const vars: Record<string, string> = {
    customer_name: customerName, company_name: companyName, event_type: typeLabel.toLowerCase(),
    date: eventDate, time: timeDisplay, location: location || 'To be confirmed',
  };

  const greeting = replacePlaceholders(template.greeting, vars);
  const bodyText = replacePlaceholders(template.body_text, vars);
  const closingText = replacePlaceholders(template.closing_text, vars);
  const footerText = replacePlaceholders(template.footer_text, vars);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,${template.header_color_from},${template.header_color_to});border-radius:16px 16px 0 0;padding:32px;text-align:center;">
${template.logo_url ? `<img src="${template.logo_url}" alt="${companyName}" style="max-width:180px;max-height:60px;object-fit:contain;margin:0 auto 12px;display:block;" />` : ''}
<h1 style="color:white;margin:0;font-size:24px;font-weight:700;">${companyName}</h1>
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${typeLabel} Confirmed ✓</p>
</div>
<div style="background:white;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<p style="color:#374151;font-size:16px;margin:0 0 24px;">${greeting}</p>
<p style="color:#374151;font-size:15px;margin:0 0 24px;">${bodyText}</p>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin:0 0 24px;">
<div style="display:flex;margin-bottom:16px;">
<div style="width:40px;height:40px;background:#dbeafe;border-radius:10px;text-align:center;line-height:40px;font-size:18px;flex-shrink:0;">📅</div>
<div style="margin-left:12px;"><p style="color:#6b7280;font-size:12px;margin:0;text-transform:uppercase;font-weight:600;">Date</p><p style="color:#111827;font-size:16px;margin:4px 0 0;font-weight:600;">${eventDate}</p></div>
</div>
<div style="display:flex;margin-bottom:16px;">
<div style="width:40px;height:40px;background:#dbeafe;border-radius:10px;text-align:center;line-height:40px;font-size:18px;flex-shrink:0;">🕐</div>
<div style="margin-left:12px;"><p style="color:#6b7280;font-size:12px;margin:0;text-transform:uppercase;font-weight:600;">Time</p><p style="color:#111827;font-size:16px;margin:4px 0 0;font-weight:600;">${timeDisplay}</p></div>
</div>
<div style="display:flex;margin-bottom:${description ? '16px' : '0'};">
<div style="width:40px;height:40px;background:#dbeafe;border-radius:10px;text-align:center;line-height:40px;font-size:18px;flex-shrink:0;">📍</div>
<div style="margin-left:12px;"><p style="color:#6b7280;font-size:12px;margin:0;text-transform:uppercase;font-weight:600;">Location</p><p style="color:#111827;font-size:16px;margin:4px 0 0;font-weight:600;">${location || 'To be confirmed'}</p></div>
</div>
${description ? `<div style="display:flex;"><div style="width:40px;height:40px;background:#dbeafe;border-radius:10px;text-align:center;line-height:40px;font-size:18px;flex-shrink:0;">📝</div><div style="margin-left:12px;"><p style="color:#6b7280;font-size:12px;margin:0;text-transform:uppercase;font-weight:600;">Notes</p><p style="color:#374151;font-size:14px;margin:4px 0 0;">${description}</p></div></div>` : ''}
</div>
<p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${closingText}</p>
<div style="border-top:1px solid #e5e7eb;padding-top:20px;">
<p style="color:#111827;font-size:15px;font-weight:600;margin:0 0 8px;">${companyName}</p>
${template.show_phone && companyPhone ? `<p style="color:#6b7280;font-size:14px;margin:0 0 4px;">📱 ${companyPhone}</p>` : ''}
${template.show_email && companyEmail ? `<p style="color:#6b7280;font-size:14px;margin:0 0 4px;">✉️ ${companyEmail}</p>` : ''}
${(template.social_website || template.social_facebook || template.social_instagram || template.social_twitter || template.social_tiktok) ? `
<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
${template.social_website ? `<a href="${template.social_website}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">🌐 Website</a>` : ''}
${template.social_facebook ? `<a href="${template.social_facebook}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">📘 Facebook</a>` : ''}
${template.social_instagram ? `<a href="${template.social_instagram}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">📸 Instagram</a>` : ''}
${template.social_twitter ? `<a href="${template.social_twitter}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">🐦 Twitter</a>` : ''}
${template.social_tiktok ? `<a href="${template.social_tiktok}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">🎵 TikTok</a>` : ''}
</div>` : ''}
</div>
</div>
<div style="text-align:center;padding:20px;"><p style="color:#9ca3af;font-size:12px;margin:0;">${footerText}</p></div>
</div>
</body></html>`;

  return { subject, html };
}

function createRawEmail(from: string, to: string, subject: string, html: string): string {
  const boundary = 'boundary_' + Date.now();
  const rawEmail = [
    `From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    Buffer.from(html).toString('base64'), `--${boundary}--`,
  ].join('\r\n');
  return Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company_id, recipient_email, recipient_name, event_type, start_time, end_time, location, description, event_id } = body;

    if (!company_id || !recipient_email) {
      return NextResponse.json({ error: 'company_id and recipient_email are required' }, { status: 400 });
    }

    // Get email connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from('email_connections').select('*').eq('company_id', company_id).eq('provider', 'gmail').single();
    if (connError || !connection) {
      return NextResponse.json({ error: 'No email connected. Please connect Gmail in Settings.' }, { status: 400 });
    }

    // Get company details - select all to handle both 'name' and 'company_name' columns
    const { data: company } = await supabaseAdmin.from('companies').select('*').eq('id', company_id).single();
    const companyName = company?.name || company?.company_name || 'Moving Company';
    const companyEmail = company?.email || undefined;
    const companyPhone = company?.phone || undefined;

    // Get email template
    const { data: config } = await supabaseAdmin.from('company_config').select('email_template').eq('company_id', company_id).maybeSingle();
    const template: EmailTemplate = { ...defaultTemplate, ...(config?.email_template || {}) };

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        await supabaseAdmin.from('email_connections').delete().eq('id', connection.id);
        return NextResponse.json({ error: 'Gmail connection expired. Please reconnect in Settings.' }, { status: 401 });
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin.from('email_connections').update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);
    }

    // Format date and time
    const startDate = new Date(start_time);
    const eventDate = startDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const eventTime = startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const eventEndTime = end_time ? new Date(end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined;

    const { subject, html } = buildConfirmationEmail({
      companyName, companyEmail, companyPhone, customerName: recipient_name || 'there',
      recipientEmail: recipient_email, eventType: event_type || 'other', eventDate, eventTime,
      eventEndTime, location: location || undefined, description: description || undefined, template,
    });

    const rawMessage = createRawEmail(connection.email_address, recipient_email, subject, html);

    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: rawMessage }),
    });

    if (!gmailResponse.ok) {
      const errData = await gmailResponse.text();
      console.error('Gmail send failed:', errData);
      await supabaseAdmin.from('email_logs').insert({
        company_id, recipient_email, recipient_name, subject,
        email_type: 'appointment_confirmation', event_id: event_id || null, status: 'failed', error_message: errData,
      });
      return NextResponse.json({ error: 'Failed to send email via Gmail' }, { status: 500 });
    }

    await supabaseAdmin.from('email_logs').insert({
      company_id, recipient_email, recipient_name, subject,
      email_type: 'appointment_confirmation', event_id: event_id || null, status: 'sent',
    });

    return NextResponse.json({ success: true, subject });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}