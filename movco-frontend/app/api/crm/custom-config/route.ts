import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_EVENT_TYPES = [
  { key: 'job', label: 'Job', color: '#3b82f6' },
  { key: 'survey', label: 'Survey', color: '#8b5cf6' },
  { key: 'callback', label: 'Callback', color: '#f59e0b' },
  { key: 'delivery', label: 'Delivery', color: '#22c55e' },
  { key: 'packing', label: 'Packing', color: '#f97316' },
  { key: 'other', label: 'Other', color: '#6b7280' },
]

// GET — fetch config
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('company_config')
    .select('custom_event_types, custom_customer_fields')
    .eq('company_id', companyId)
    .maybeSingle()

  return NextResponse.json({
    event_types: data?.custom_event_types || DEFAULT_EVENT_TYPES,
    customer_fields: data?.custom_customer_fields || [],
    defaults: { event_types: DEFAULT_EVENT_TYPES },
  })
}

// POST — update config
export async function POST(req: NextRequest) {
  try {
    const { company_id, event_types, customer_fields } = await req.json()
    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    const updates: any = {}
    if (event_types !== undefined) updates.custom_event_types = event_types
    if (customer_fields !== undefined) updates.custom_customer_fields = customer_fields

    const { error } = await supabase
      .from('company_config')
      .upsert({ company_id, ...updates }, { onConflict: 'company_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}