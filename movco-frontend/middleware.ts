import { NextRequest, NextResponse } from 'next/server'

// Domains that belong to the MOVCO app itself (not client sites)
const APP_DOMAINS = [
  'movco-quote-system.vercel.app',
  'localhost:3000',
  'localhost',
]

export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || ''

  // Strip port for comparison
  const cleanHost = hostname.replace(/:\d+$/, '')

  // If it's a known app domain, let the request through normally
  if (APP_DOMAINS.some(d => cleanHost === d || cleanHost.endsWith(`.${d}`))) {
    return NextResponse.next()
  }

  // If it's a custom domain, rewrite to the domain lookup route
  // Strip www. for consistent lookup
  const domain = cleanHost.replace(/^www\./, '')

  // Only intercept page requests, not API/static/internal routes
  const path = req.nextUrl.pathname
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    path.startsWith('/favicon') ||
    path.includes('.')
  ) {
    return NextResponse.next()
  }

  // Rewrite to the domain-based site route
  const url = req.nextUrl.clone()
  url.pathname = `/api/sites/by-domain/${domain}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Run on all routes except static files and Next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}