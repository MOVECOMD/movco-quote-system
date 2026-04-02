import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { company_id } = await req.json()
    if (!company_id) {
      return NextResponse.json({ success: false, error: 'Missing company_id' }, { status: 400 })
    }

    // Get current website + undo snapshot
    const { data: website, error: fetchErr } = await supabase
      .from('company_websites')
      .select('blocks, theme, custom_html, undo_snapshot')
      .eq('company_id', company_id)
      .maybeSingle()

    if (fetchErr || !website) {
      return NextResponse.json({ success: false, error: 'Website not found' }, { status: 404 })
    }

    if (!website.undo_snapshot) {
      return NextResponse.json({ success: false, error: 'Nothing to undo — no previous version saved' })
    }

    const snapshot = website.undo_snapshot as any

    // Restore from snapshot and clear it
    const { error: updateErr } = await supabase
      .from('company_websites')
      .update({
        blocks: snapshot.blocks || [],
        theme: snapshot.theme || { primary_color: '#0a0f1c', accent_color: '#0F6E56' },
        custom_html: snapshot.custom_html || null,
        undo_snapshot: null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', company_id)

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Reverted to version from ${snapshot.timestamp ? new Date(snapshot.timestamp).toLocaleString('en-GB') : 'before last edit'}`,
      description: snapshot.description || null,
    })
  } catch (err: any) {
    console.error('Undo error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// GET — check if undo is available
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) {
    return NextResponse.json({ available: false })
  }

  const { data } = await supabase
    .from('company_websites')
    .select('undo_snapshot')
    .eq('company_id', companyId)
    .maybeSingle()

  const snapshot = data?.undo_snapshot as any
  return NextResponse.json({
    available: !!snapshot,
    timestamp: snapshot?.timestamp || null,
    description: snapshot?.description || null,
  })
}


