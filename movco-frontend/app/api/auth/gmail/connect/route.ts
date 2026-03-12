import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('company_id');

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  // Determine the base URL from the request
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || 'movco-quote-system.vercel.app';
  const baseUrl = `${protocol}://${host}`;

  const redirectUri = `${baseUrl}/api/auth/gmail/callback`;

  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', companyId);

  return NextResponse.redirect(authUrl.toString());
}
