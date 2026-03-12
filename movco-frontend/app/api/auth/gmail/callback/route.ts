import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const companyId = searchParams.get('state');
  const error = searchParams.get('error');

  // Determine base URL
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || 'movco-quote-system.vercel.app';
  const baseUrl = `${protocol}://${host}`;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=${error}`);
  }

  if (!code || !companyId) {
    return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=missing_params`);
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/gmail/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.text();
      console.error('Token exchange failed:', errData);
      return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      console.error('Missing tokens:', tokenData);
      return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=missing_tokens`);
    }

    // Get the user's email address
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=userinfo_failed`);
    }

    const userInfo = await userInfoResponse.json();
    const emailAddress = userInfo.email;

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert the email connection
    const { error: dbError } = await supabaseAdmin
      .from('email_connections')
      .upsert(
        {
          company_id: companyId,
          provider: 'gmail',
          email_address: emailAddress,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,provider' }
      );

    if (dbError) {
      console.error('DB error saving email connection:', dbError);
      return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=db_error`);
    }

    return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=connected&address=${encodeURIComponent(emailAddress)}`);
  } catch (err) {
    console.error('Gmail callback error:', err);
    return NextResponse.redirect(`${baseUrl}/company-dashboard/settings?email=error&reason=unknown`);
  }
}