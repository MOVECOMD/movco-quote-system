import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { company_id, slug, blocks, theme, published, custom_domain, custom_html } = await req.json()

    if (!company_id || !slug) {
      return NextResponse.json({ error: 'Missing company_id or slug' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('company_websites')
      .select('id')
      .eq('company_id', company_id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('company_websites')
        .update({ slug, blocks, theme, published, custom_domain, custom_html, updated_at: new Date().toISOString() })
        .eq('company_id', company_id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('company_websites')
        .insert({ company_id, slug, blocks, theme, published, custom_domain, custom_html })
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Website save error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const company_id = req.nextUrl.searchParams.get('company_id')
  if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('company_websites')
    .select('*')
    .eq('company_id', company_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ website: data })
}