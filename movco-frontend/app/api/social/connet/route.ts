import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

export async function GET(req: NextRequest) {
  const { data } = await supabase
    .from('social_connections')
    .select('*')
    .eq('company_id', COMPANY_ID)
  return NextResponse.json({ connections: data || [] })
}

export async function POST(req: NextRequest) {
  try {
    const { platform, access_token, refresh_token, page_id, page_name, expires_at } = await req.json()

    const { data: existing } = await supabase
      .from('social_connections')
      .select('id')
      .eq('company_id', COMPANY_ID)
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
        .insert({ company_id: COMPANY_ID, platform, access_token, refresh_token, page_id, page_name, expires_at, connected: true })
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
    .eq('company_id', COMPANY_ID)
    .eq('platform', platform)

  return NextResponse.json({ success: true })
}
