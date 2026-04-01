import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)



export async function POST(req: NextRequest) {
  try {
    const { to_phone, to_name, customer_id, message_text, template_name, company_id: COMPANY_ID } = await req.json()
    if (!COMPANY_ID) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    if (!to_phone || !message_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Format phone number
    const phone = to_phone.replace(/\D/g, '').replace(/^0/, '44')

    // If API credentials exist, send via Meta API
    if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message_text },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        console.error('WhatsApp API error:', data)
        // Still log to DB even if send fails
      }
    }

    // Always log to database
    const { error } = await supabase.from('whatsapp_messages').insert({
      company_id: COMPANY_ID,
      customer_id: customer_id || null,
      customer_phone: phone,
      customer_name: to_name || phone,
      direction: 'outbound',
      message_text,
      template_name: template_name || null,
      status: process.env.WHATSAPP_ACCESS_TOKEN ? 'sent' : 'pending',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ 
      success: true,
      note: !process.env.WHATSAPP_ACCESS_TOKEN ? 'Message logged — WhatsApp API not yet connected' : undefined
    })
  } catch (err: any) {
    console.error('WhatsApp send error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}