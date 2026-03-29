import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { deal_id } = await req.json()

  const { data: deal } = await supabase
    .from('crm_deals')
    .select('*')
    .eq('id', deal_id)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const { data: quote } = await supabase
    .from('crm_quotes')
    .select('*')
    .eq('deal_id', deal_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prompt = `You are a removals operations assistant. Generate a structured day plan for the following job.

Job details:
- Customer: ${deal.customer_name || 'Unknown'}
- Moving from: ${deal.moving_from || 'Not specified'}
- Moving to: ${deal.moving_to || 'Not specified'}
- Phone: ${deal.customer_phone || 'Not specified'}
- Job date: ${deal.moving_date || 'Not set'}
- Crew required: ${quote?.movers || 'Not specified'}
- Vans required: ${quote?.van_count || 'Not specified'}
- Estimated hours: ${quote?.estimated_hours || 'Not specified'}
- Job notes: ${deal.notes || 'None'}

Generate a clear, practical hour-by-hour day plan for the crew. Include arrival, loading, travel, unloading and wrap-up. Keep it concise and crew-friendly.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const aiData = await response.json()
  const ai_plan = aiData.content?.[0]?.text || 'Could not generate plan.'

  return NextResponse.json({ ai_plan })
}