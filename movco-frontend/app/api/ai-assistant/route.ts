import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
const { messages } = body
const isOnboarding = body.onboarding === true

if (isOnboarding) {
  const templateLabel = body.template_label || 'business'
  const onboardingPrompt = `You are a friendly onboarding assistant for buildyourmanagement.co.uk. You are setting up a ${templateLabel} CRM for a new user.

Ask these questions one at a time in a conversational way:
1. What areas or postcodes do they cover?
2. What are their main services?
3. What is their typical pricing?
4. What is their business phone number?
5. What colour would they like for their branding? (offer: green, blue, purple, orange)

After all 5 answers, return this JSON:
{
  "message": "Perfect! I have everything I need. Your system is being configured now...",
  "onboarding_complete": true,
  "onboarding_data": {
    "coverage": "their answer",
    "services": "their answer",
    "pricing": "their answer",
    "phone": "their answer",
    "brand_colour": "their answer"
  }
}

Keep responses short and friendly. One question at a time. Always return valid JSON with at least a message field. Never include JSON inside the message field.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: onboardingPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    }),
  })

  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'
  let parsed
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    parsed = { message: text, onboarding_complete: false }
  }
  return NextResponse.json(parsed)
}

    // Fetch live CRM context
    const [dealsRes, customersRes, eventsRes, postsRes] = await Promise.all([
      supabase.from('crm_deals').select('id, customer_name, customer_email, customer_phone, stage_id, moving_date, estimated_value, moving_from, moving_to').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('crm_customers').select('id, name, email, phone, moving_from, moving_to, moving_date').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(50),
      supabase.from('crm_diary_events').select('id, title, start_time, end_time, event_type, customer_name, location, completed').eq('company_id', COMPANY_ID).order('start_time', { ascending: true }).limit(30),
      supabase.from('social_posts').select('id, content, platforms, status, scheduled_at').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(10),
    ])
    console.log('Deals found:', dealsRes.data?.length, 'Error:', dealsRes.error?.message)

    const stages = [
      { id: '6a36fa88-8220-47b1-9f6d-98f63f630943', name: 'New Lead' },
      { id: '1fe63154-4ae2-4384-a62e-c65985571197', name: 'In Conversation' },
      { id: '8be5de73-12ca-4bec-924f-e50060ae5ddc', name: 'Contacted' },
      { id: '68cf884a-4330-41ea-b86c-6e7fc861d0ad', name: 'Appointment' },
      { id: '75d775ab-8670-44f3-a182-ca6411aaed42', name: 'Quote Sent' },
      { id: '79cc52aa-68bc-4297-bfbb-a23748621e32', name: 'Booked' },
    ]

    const today = new Date().toISOString().split('T')[0]

    const systemPrompt = `You are an AI assistant built into MOVCO, a CRM for removal companies. You help the user manage their business through natural language commands.

Today's date: ${today}

LIVE CRM DATA:
Deals (${dealsRes.data?.length || 0}): ${JSON.stringify(dealsRes.data?.slice(0, 20) || [])}
Customers (${customersRes.data?.length || 0}): ${JSON.stringify(customersRes.data?.slice(0, 20) || [])}
Diary events (upcoming): ${JSON.stringify(eventsRes.data?.slice(0, 15) || [])}
Recent social posts: ${JSON.stringify(postsRes.data || [])}
Pipeline stages: ${JSON.stringify(stages)}

You can execute one OR MULTIPLE actions by returning structured JSON in this exact format:

{
  "message": "Friendly summary of what you are about to do",
  "actions": [
    { "type": "move_deal", "data": { ... } },
    { "type": "send_email", "data": { ... } }
  ],
  "requires_confirm": true | false
}

For a single action, still use the "actions" array with one item.
For read-only answers, use actions: [{ "type": "answer", "data": { "summary": "..." } }]

ACTION FORMATS:

send_email:
{
  "type": "send_email",
  "data": {
    "to_email": "email@example.com",
    "to_name": "Customer Name",
    "subject": "Subject line",
    "body": "Full email body text"
  }
}

book_event:
{
  "type": "book_event",
  "data": {
    "title": "Event title",
    "event_type": "survey" | "job" | "callback" | "other",
    "start_time": "ISO datetime",
    "end_time": "ISO datetime or null",
    "customer_name": "Name or null",
    "location": "Address or null",
    "deal_id": "uuid or null"
  }
}

move_deal:
{
  "type": "move_deal",
  "data": {
    "deal_id": "uuid",
    "deal_name": "Customer name for display",
    "new_stage_id": "uuid",
    "new_stage_name": "Stage name for display"
  }
}

schedule_post:
{
  "type": "schedule_post",
  "data": {
    "content": "Post text",
    "platforms": ["facebook", "instagram", "linkedin"],
    "scheduled_at": "ISO datetime or null for immediate"
  }
}

create_pipeline_stage:
{
  "type": "create_pipeline_stage",
  "data": {
    "name": "Stage name",
    "color": "#22c55e"
  }
}

answer:
{
  "type": "answer",
  "data": {
    "summary": "The answer to the question"
  }
}
RULES:
- For actions that send or create things (email, event, post, move deal) always set requires_confirm: true
- For read-only questions set requires_confirm: false and use action type "answer"
- Match customers/deals from the live data by name — be fuzzy, "John" matches "John Smith"
- If you cannot find the customer/deal mentioned, say so clearly in message
- Keep message friendly and concise — 1-2 sentences max
- For emails, write a professional but warm email body appropriate for a removal company
- Always return valid JSON, nothing else
- For create_pipeline_stage, pick a sensible hex color if the user doesn't specify one. Use green (#22c55e) as default.
- The "message" field must contain plain conversational text only — never include JSON, curly braces, or any structured data inside the message field
- Never repeat or echo the JSON structure inside the message field
- Keep the message field to 1-2 friendly sentences maximum`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 
  'Content-Type': 'application/json',
  'x-api-key': process.env.ANTHROPIC_API_KEY!,
  'anthropic-version': '2023-06-01',
},
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'

    let parsed
    try {
      const clean = text.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed = { message: text, action: null, requires_confirm: false }
    }

    // Handle create_pipeline_stage server-side
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        if (action.type === 'create_pipeline_stage') {
          const { name, color } = action.data
          const { data: existingStages } = await supabase
            .from('crm_pipeline_stages')
            .select('position')
            .eq('company_id', COMPANY_ID)
            .order('position', { ascending: false })
            .limit(1)

          const nextPosition = (existingStages?.[0]?.position || 0) + 1

          const { error } = await supabase
            .from('crm_pipeline_stages')
            .insert({
              company_id: COMPANY_ID,
              name,
              color: color || '#22c55e',
              position: nextPosition,
            })

          if (error) {
            console.error('create_pipeline_stage error:', error)
            action.data.error = error.message
          } else {
            action.data.created = true
          }
        }
      }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('AI assistant error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.', action: null, requires_confirm: false }, { status: 500 })
  }
}