import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: website } = await supabase
    .from('company_websites')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!website) {
    return new NextResponse('Not found', { status: 404 })
  }

  const html = website.custom_html || '<html><body><p>No content</p></body></html>'

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}