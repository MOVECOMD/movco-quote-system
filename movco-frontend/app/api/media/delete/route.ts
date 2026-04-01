import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { file_id, file_url } = await req.json()
  if (!file_id) return NextResponse.json({ error: 'Missing file_id' }, { status: 400 })

  try {
    const url = new URL(file_url)
    const path = url.pathname.split('/object/public/crm-files/')[1]
    if (path) {
      await supabase.storage.from('crm-files').remove([path])
    }
    await supabase.from('media_library').delete().eq('id', file_id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}