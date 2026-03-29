import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { deal_id } = await req.json()

  // Fetch deal + contact data
  const { data: deal } = await supabase
    .from('crm_deals')
    .select('*, crm_contacts(*)')
    .eq('id', deal_id)
    .single()

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  const prompt = `You are a removals operations assistant. Generate a structured day plan for the following job.

Job details:
- Customer: ${deal.crm_contacts?.name || 'Unknown'}
- Address: ${deal.crm_contacts?.address || deal.address || 'Not specified'}
- Phone: ${deal.crm_contacts?.phone || 'Not specified'}
- Job date: ${deal.scheduled_date || 'Not set'}
- Crew required: ${deal.crew_count || deal.quote_data?.crew_count || 'Not specified'}
- Vans required: ${deal.van_count || deal.quote_data?.van_count || 'Not specified'}
- Job notes: ${deal.notes || 'None'}
- Deal value: ${deal.value ? '£' + deal.value : 'Not specified'}

Generate a clear, practical day plan for the crew. Include:
1. Suggested start time and arrival time at customer
2. Key tasks / job reminders
3. Any operational notes (parking, access, crew briefing points)
4. A simple timeline for the day

Keep it concise and crew-friendly — this will be printed and handed to the team.`

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
  const aiPlan = aiData.content?.[0]?.text || 'Could not generate plan.'

  return NextResponse.json({
    ai_plan: aiPlan,
    deal
  })
}