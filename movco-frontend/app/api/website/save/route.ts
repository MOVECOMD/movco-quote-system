// ============================================================
// FILE: movco-frontend/app/api/website/save/route.ts
// REPLACE your existing save route with this
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { renderSiteHtml } from '../../../../lib/renderSiteHtml'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

  const { data } = await supabase
    .from('company_websites')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  return NextResponse.json({ website: data })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id, slug, blocks, theme, published, custom_domain, custom_html } = body

    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    // Get company info for the renderer
    const { data: company } = await supabase
      .from('companies')
      .select('name, email, phone')
      .eq('id', company_id)
      .maybeSingle()

    // Auto-render blocks to HTML (if blocks exist and no manual custom_html override)
    let finalHtml = custom_html || null

    if (blocks && blocks.length > 0) {
      // Always render blocks to HTML — this keeps the site in sync
      const renderedHtml = renderSiteHtml(
        blocks,
        theme || { primary_color: '#0a0f1c', accent_color: '#0F6E56' },
        company || {}
      )
      // Use rendered HTML unless user has explicitly set custom HTML that doesn't come from blocks
      if (!custom_html || custom_html === '[FROM_BLOCKS]') {
        finalHtml = renderedHtml
      }
    }

    const { data: existing } = await supabase
      .from('company_websites')
      .select('id')
      .eq('company_id', company_id)
      .maybeSingle()

    const websiteData = {
      company_id,
      slug: slug || null,
      blocks: blocks || [],
      theme: theme || { primary_color: '#0a0f1c', accent_color: '#0F6E56' },
      published: published ?? false,
      custom_domain: custom_domain || null,
      custom_html: finalHtml,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await supabase
        .from('company_websites')
        .update(websiteData)
        .eq('company_id', company_id)
      if (error) return NextResponse.json({ error: error.message, success: false })
    } else {
      const { error } = await supabase
        .from('company_websites')
        .insert(websiteData)
      if (error) return NextResponse.json({ error: error.message, success: false })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, success: false }, { status: 500 })
  }
}