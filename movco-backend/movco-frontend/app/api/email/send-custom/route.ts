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
    const { company_id, recipient_email, recipient_name, subject, body_text } = body;

    if (!company_id || !recipient_email || !subject || !body_text) {
      return NextResponse.json(
        { error: 'company_id, recipient_email, subject, and body_text are required' },
        { status: 400 }
      );
    }

    // Get email connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from('email_connections')
      .select('*')
      .eq('company_id', company_id)
      .eq('provider', 'gmail')
      .single();

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'No email connected. Please connect Gmail in Settings.' },
        { status: 400 }
      );
    }

    // Get company details
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    const companyName = company?.name || company?.company_name || 'Moving Company';
    const companyEmail = company?.email || '';
    const companyPhone = company?.phone || '';

    // Get email template for branding
    const { data: config } = await supabaseAdmin
      .from('company_config')
      .select('email_template')
      .eq('company_id', company_id)
      .maybeSingle();

    const template = config?.email_template || {};
    const headerFrom = template.header_color_from || '#1e40af';
    const headerTo = template.header_color_to || '#4f46e5';
    const logoUrl = template.logo_url || '';
    const showPhone = template.show_phone !== false;
    const showEmail = template.show_email !== false;
    const footerText = template.footer_text || 'This email was sent by {company_name} via MOVCO';
    const socialWebsite = template.social_website || '';
    const socialFacebook = template.social_facebook || '';
    const socialInstagram = template.social_instagram || '';
    const socialTwitter = template.social_twitter || '';
    const socialTiktok = template.social_tiktok || '';

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (new Date(connection.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        await supabaseAdmin.from('email_connections').delete().eq('id', connection.id);
        return NextResponse.json(
          { error: 'Gmail connection expired. Please reconnect in Settings.' },
          { status: 401 }
        );
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin.from('email_connections').update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);
    }

    // Convert plain text body to HTML paragraphs
    const bodyHtml = body_text
      .split('\n')
      .map((line: string) => line.trim())
      .map((line: string) => line ? `<p style="color:#374151;font-size:15px;margin:0 0 12px;">${line}</p>` : '<br/>')
      .join('\n');

    const resolvedFooter = footerText.replace(/\{company_name\}/g, companyName);

    // Build branded HTML email
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,${headerFrom},${headerTo});border-radius:16px 16px 0 0;padding:32px;text-align:center;">
${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-width:180px;max-height:60px;object-fit:contain;margin:0 auto 12px;display:block;" />` : ''}
<h1 style="color:white;margin:0;font-size:24px;font-weight:700;">${companyName}</h1>
</div>
<div style="background:white;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<p style="color:#374151;font-size:16px;margin:0 0 24px;">Hi ${recipient_name || 'there'},</p>
${bodyHtml}
<div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:24px;">
<p style="color:#111827;font-size:15px;font-weight:600;margin:0 0 8px;">${companyName}</p>
${showPhone && companyPhone ? `<p style="color:#6b7280;font-size:14px;margin:0 0 4px;">📱 ${companyPhone}</p>` : ''}
${showEmail && companyEmail ? `<p style="color:#6b7280;font-size:14px;margin:0 0 4px;">✉️ ${companyEmail}</p>` : ''}
${(socialWebsite || socialFacebook || socialInstagram || socialTwitter || socialTiktok) ? `
<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
${socialWebsite ? `<a href="${socialWebsite}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">🌐 Website</a>` : ''}
${socialFacebook ? `<a href="${socialFacebook}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">📘 Facebook</a>` : ''}
${socialInstagram ? `<a href="${socialInstagram}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">📸 Instagram</a>` : ''}
${socialTwitter ? `<a href="${socialTwitter}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">🐦 Twitter</a>` : ''}
${socialTiktok ? `<a href="${socialTiktok}" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:8px;color:#374151;font-size:12px;text-decoration:none;font-weight:500;">🎵 TikTok</a>` : ''}
</div>` : ''}
</div>
</div>
<div style="text-align:center;padding:20px;"><p style="color:#9ca3af;font-size:12px;margin:0;">${resolvedFooter}</p></div>
</div>
</body></html>`;

    const rawMessage = createRawEmail(connection.email_address, recipient_email, subject, html);

    // Send via Gmail API
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
      console.error('Gmail send-custom failed:', errData);
      await supabaseAdmin.from('email_logs').insert({
        company_id,
        recipient_email,
        recipient_name: recipient_name || null,
        subject,
        email_type: 'custom',
        status: 'failed',
        error_message: errData,
      });
      return NextResponse.json({ error: 'Failed to send email via Gmail' }, { status: 500 });
    }

    // Log success
    await supabaseAdmin.from('email_logs').insert({
      company_id,
      recipient_email,
      recipient_name: recipient_name || null,
      subject,
      email_type: 'custom',
      status: 'sent',
    });

    return NextResponse.json({ success: true, subject });
  } catch (err: any) {
    console.error('Send custom email error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}