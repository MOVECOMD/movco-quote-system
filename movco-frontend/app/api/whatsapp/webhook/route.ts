import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)



// Webhook verification (Meta requires this)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'movco_whatsapp_webhook_2026'
  if (mode === 'subscribe' && token === verifyToken) {

    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// Receive incoming messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value?.messages) return NextResponse.json({ status: 'ok' })

    // Look up company from WhatsApp connection
    const { data: waConn } = await supabase
      .from('social_connections')
      .select('company_id')
      .eq('platform', 'whatsapp')
      .eq('connected', true)
      .maybeSingle()
    const COMPANY_ID = waConn?.company_id
    if (!COMPANY_ID) return NextResponse.json({ status: 'no company found' })

    for (const message of value.messages) {
      if (message.type !== 'text') continue

      const phone = message.from
      const text = message.text?.body || ''
      const waMessageId = message.id

      // Try to find matching customer
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('id, name')
        .eq('company_id', COMPANY_ID)
        .ilike('phone', `%${phone.slice(-10)}%`)
        .maybeSingle()

      await supabase.from('whatsapp_messages').insert({
        company_id: COMPANY_ID,
        customer_id: customer?.id || null,
        customer_phone: phone,
        customer_name: customer?.name || value.contacts?.[0]?.profile?.name || phone,
        direction: 'inbound',
        message_text: text,
        whatsapp_message_id: waMessageId,
        status: 'received',
      })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}