import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params

  // Look up the website by custom_domain field
  const { data: website } = await supabase
    .from('company_websites')
    .select('*')
    .eq('custom_domain', domain)
    .eq('published', true)
    .maybeSingle()

  // Also try with www prefix if not found
  if (!website) {
    const { data: wwwWebsite } = await supabase
      .from('company_websites')
      .select('*')
      .eq('custom_domain', `www.${domain}`)
      .eq('published', true)
      .maybeSingle()

    if (!wwwWebsite) {
      // Last resort: try matching the slug to the domain name
      const slugGuess = domain.replace(/\.(com|co\.uk|uk|net|org|io)$/i, '').replace(/[^a-z0-9]/gi, '')
      const { data: slugWebsite } = await supabase
        .from('company_websites')
        .select('*')
        .eq('slug', slugGuess)
        .eq('published', true)
        .maybeSingle()

      if (!slugWebsite) {
        return new NextResponse('<html><body><h1>Site not found</h1><p>No website is configured for this domain.</p></body></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      return serveSite(slugWebsite)
    }

    return serveSite(wwwWebsite)
  }

  return serveSite(website)
}

function serveSite(website: any) {
  const html = website.custom_html || '<html><body><p>No content</p></body></html>'

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}