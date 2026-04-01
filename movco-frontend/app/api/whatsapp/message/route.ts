import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)



export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customer_id = searchParams.get('customer_id')
  const phone = searchParams.get('phone')
  const COMPANY_ID = searchParams.get('company_id')
  if (!COMPANY_ID) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

  let query = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: true })

  if (customer_id) query = query.eq('customer_id', customer_id)
  else if (phone) query = query.eq('customer_phone', phone)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data || [] })
}