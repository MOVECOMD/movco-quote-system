import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)



export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
  const { data } = await supabase
    .from('social_connections')
    .select('*')
    .eq('company_id', companyId)
  return NextResponse.json({ connections: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { platform, access_token, refresh_token, page_id, page_name, expires_at, company_id } = body
    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    const { data: existing } = await supabase
      .from('social_connections')
      .select('id')
      .eq('company_id', req.nextUrl.searchParams.get('company_id')!)
      .eq('platform', platform)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('social_connections')
        .update({ access_token, refresh_token, page_id, page_name, expires_at, connected: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('social_connections')
        .insert({ company_id, platform, access_token, refresh_token, page_id, page_name, expires_at, connected: true })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'Missing platform' }, { status: 400 })

  await supabase
    .from('social_connections')
    .update({ connected: false, access_token: null, refresh_token: null })
    .eq('company_id', req.nextUrl.searchParams.get('company_id')!)
    .eq('platform', platform)

  return NextResponse.json({ success: true })
}
