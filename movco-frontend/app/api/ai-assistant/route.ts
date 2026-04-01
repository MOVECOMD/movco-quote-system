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

    // Fetch ALL live CRM context including real pipeline stages
    const [dealsRes, customersRes, eventsRes, stagesRes, tasksRes, quotesRes] = await Promise.all([
      supabase.from('crm_deals').select('id, customer_name, customer_email, customer_phone, stage_id, moving_date, estimated_value, moving_from, moving_to, notes, created_at').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('crm_customers').select('id, name, email, phone, moving_from, moving_to, moving_date, notes').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(100),
      supabase.from('crm_diary_events').select('id, title, start_time, end_time, event_type, customer_name, location, completed, deal_id').eq('company_id', COMPANY_ID).order('start_time', { ascending: true }).limit(50),
      supabase.from('crm_pipeline_stages').select('id, name, color, position').eq('company_id', COMPANY_ID).order('position'),
      supabase.from('crm_customer_tasks').select('id, customer_id, title, due_date, completed').eq('company_id', COMPANY_ID).eq('completed', false).order('due_date', { ascending: true }),
      supabase.from('crm_quotes').select('id, customer_name, estimated_price, status, deal_id, created_at, moving_date').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(20),
    ])

    const stages = stagesRes.data || []
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Calculate revenue this month
    const thisMonth = today.getMonth()
    const thisYear = today.getFullYear()
    const completedJobsThisMonth = eventsRes.data?.filter(e => {
      if (!e.completed || e.event_type !== 'job') return false
      const d = new Date(e.start_time)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }) || []

    const dealsWithCompletedJobs = dealsRes.data?.filter(d =>
      completedJobsThisMonth.some(e => e.deal_id === d.id)
    ) || []
    const revenueThisMonth = dealsWithCompletedJobs.reduce((s, d) => s + (d.estimated_value || 0), 0)

    // Pipeline value by stage
    const pipelineByStage = stages.map(stage => ({
      stage: stage.name,
      count: dealsRes.data?.filter(d => d.stage_id === stage.id).length || 0,
      value: dealsRes.data?.filter(d => d.stage_id === stage.id).reduce((s, d) => s + (d.estimated_value || 0), 0) || 0,
    }))

    // Overdue tasks
    const overdueTasks = tasksRes.data?.filter(t => new Date(t.due_date) < today) || []

    // Upcoming jobs this week
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const upcomingJobs = eventsRes.data?.filter(e => {
      if (e.event_type !== 'job' || e.completed) return false
      const d = new Date(e.start_time)
      return d >= today && d <= weekEnd
    }) || []

    const systemPrompt = `You are an AI assistant built into MOVCO, a CRM for removal companies. You help the user manage their business through natural language.

Today's date: ${todayStr}

LIVE CRM DATA:
Pipeline stages (THESE ARE THE REAL STAGES — always use these IDs): ${JSON.stringify(stages)}
Deals (${dealsRes.data?.length || 0} total): ${JSON.stringify(dealsRes.data || [])}
Customers (${customersRes.data?.length || 0} total): ${JSON.stringify(customersRes.data?.slice(0, 50) || [])}
Diary events: ${JSON.stringify(eventsRes.data || [])}
Quotes: ${JSON.stringify(quotesRes.data || [])}

PRE-COMPUTED STATS:
Revenue this month: £${revenueThisMonth.toLocaleString()} (from ${completedJobsThisMonth.length} completed jobs)
Pipeline value by stage: ${JSON.stringify(pipelineByStage)}
Overdue tasks (${overdueTasks.length}): ${JSON.stringify(overdueTasks.slice(0, 10))}
Upcoming jobs this week (${upcomingJobs.length}): ${JSON.stringify(upcomingJobs)}

Return structured JSON in this exact format:
{
  "message": "Friendly summary of what you are about to do or the answer",
  "actions": [ ... ],
  "requires_confirm": true | false
}

ACTION FORMATS:

send_email:
{ "type": "send_email", "data": { "to_email": "email", "to_name": "name", "subject": "subject", "body": "body" } }

book_event:
{ "type": "book_event", "data": { "title": "title", "event_type": "survey|job|callback|other", "start_time": "ISO", "end_time": "ISO or null", "customer_name": "name or null", "location": "address or null", "deal_id": "uuid or null" } }

move_deal:
{ "type": "move_deal", "data": { "deal_id": "uuid", "deal_name": "name", "new_stage_id": "uuid", "new_stage_name": "stage name" } }

create_deal:
{ "type": "create_deal", "data": { "customer_name": "name", "customer_email": "email or null", "customer_phone": "phone or null", "moving_from": "address or null", "moving_to": "address or null", "moving_date": "ISO date or null", "estimated_value": number or null, "stage_id": "uuid of first stage", "notes": "notes or null" } }

create_customer:
{ "type": "create_customer", "data": { "name": "name", "email": "email or null", "phone": "phone or null", "moving_from": "address or null", "moving_to": "address or null", "moving_date": "ISO date or null", "notes": "notes or null" } }

add_note:
{ "type": "add_note", "data": { "customer_id": "uuid", "customer_name": "name", "note_text": "the note" } }

add_task:
{ "type": "add_task", "data": { "customer_id": "uuid", "customer_name": "name", "title": "task title", "due_date": "ISO datetime" } }

create_pipeline_stage:
{ "type": "create_pipeline_stage", "data": { "name": "stage name", "color": "#hex" } }

schedule_post:
{ "type": "schedule_post", "data": { "content": "post text", "platforms": ["facebook","instagram","linkedin"], "scheduled_at": "ISO or null" } }

edit_website:
{ "type": "edit_website", "data": { "action": "update_block" | "add_block" | "remove_block" | "update_theme" | "set_custom_html", "block_type": "hero|services|about|reviews|coverage|quote_form|contact|gallery", "block_index": number or null, "block_data": { ...fields to update } | null, "theme": { "primary_color": "#hex", "accent_color": "#hex" } | null, "custom_html": "full HTML string or null" } }

answer:
{ "type": "answer", "data": { "summary": "answer text" } }

RULES:
- ALWAYS use the real pipeline stage IDs from the data above — never invent stage IDs
- You CAN and SHOULD execute create_customer, create_deal, add_note and add_task actions — they are fully connected to the live database. Never tell the user to do it manually.
- When a user asks to add a contact or create a deal, always return the appropriate action JSON — do not apologise or say you cannot do it
- Match customers/deals by name fuzzy — "John" matches "John Smith"
- ALWAYS set requires_confirm: true when there are ANY actions — no exceptions
- For read-only answers only: requires_confirm: false, use "answer" action type
- Never set requires_confirm: false when there are actions in the array
- If customer not found for add_note or add_task, say so clearly
- Keep message to 1-2 friendly sentences maximum — no bullet points, no bold text, no lists, no JSON in message field
- Never summarise the action data back in the message field — just confirm it worked in plain conversational English e.g. "Simon Jones has been added as a customer and placed in the New Lead stage."
- - Always return valid JSON only — no markdown code blocks, no backticks around the JSON
- When the user asks to "see preview", "show preview" or "can I see", always return the SAME actions array again with requires_confirm: true — never describe email content as plain text
- Never write email body content in the message field — emails always go in the actions array only
- When user says "change my hero headline to X" use edit_website with action: update_block, block_type: hero, block_data: { headline: "X" }
- When user says "change my accent colour to X" use edit_website with action: update_theme, theme: { accent_color: "#hex" }
- When user says "add a X section to my website" use edit_website with action: add_block, block_type: X
- When user says "remove the X block" use edit_website with action: remove_block, block_type: X
- When user says "set my website to custom HTML" use edit_website with action: set_custom_html, custom_html: "the HTML"
- When user says "build me a website" or "create a website for" or "make a site for", use edit_website with action: build_page — generate ALL appropriate blocks from scratch based on their description and populate them with real content based on what they tell you. Set block_data to an array of fully populated block objects.
- When user says "suggest improvements" or "review my website" or "how can I improve my site", use edit_website with action: suggest_improvements — read the current blocks and return specific actionable suggestions in the message field. No blocks need updating yet.
- When user says "edit my HTML" or "update my HTML" or "change X in my HTML", use edit_website with action: edit_html — read the existing custom_html and return a modified version with the requested changes applied. Set custom_html to the full updated HTML string.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
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
      parsed = { message: text, actions: [], requires_confirm: false }
    }

    // Helper — get or create customer record
    const getOrCreateCustomer = async (customerName: string, customerEmail?: string): Promise<string | null> => {
      if (customerEmail) {
        const { data } = await supabase.from('crm_customers').select('id').eq('company_id', COMPANY_ID).ilike('email', customerEmail).maybeSingle()
        if (data?.id) return data.id
      }
      const { data: byName } = await supabase.from('crm_customers').select('id').eq('company_id', COMPANY_ID).ilike('name', `%${customerName}%`).maybeSingle()
      if (byName?.id) return byName.id

      const { data: deal } = await supabase.from('crm_deals').select('id, customer_id, customer_name, customer_email, customer_phone, moving_from, moving_to, moving_date, notes').eq('company_id', COMPANY_ID).ilike('customer_name', `%${customerName}%`).maybeSingle()
      if (deal?.customer_id) return deal.customer_id

      const { data: newCustomer } = await supabase.from('crm_customers').insert({
        company_id: COMPANY_ID,
        name: deal?.customer_name || customerName,
        email: deal?.customer_email || customerEmail || null,
        phone: deal?.customer_phone || null,
        moving_from: deal?.moving_from || null,
        moving_to: deal?.moving_to || null,
        moving_date: deal?.moving_date || null,
        notes: deal?.notes || null,
      }).select().single()

      if (newCustomer?.id && deal?.id) {
        await supabase.from('crm_deals').update({ customer_id: newCustomer.id }).eq('id', deal.id)
      }
      return newCustomer?.id || null
    }

    const logNote = async (customerId: string, noteText: string) => {
      await supabase.from('crm_customer_notes').insert({
        company_id: COMPANY_ID,
        customer_id: customerId,
        note_text: noteText,
      })
    }

    // Handle server-side actions
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        try {

          if (action.type === 'create_pipeline_stage') {
            const { name, color } = action.data
            const { data: existingStages } = await supabase.from('crm_pipeline_stages').select('position').eq('company_id', COMPANY_ID).order('position', { ascending: false }).limit(1)
            const nextPosition = (existingStages?.[0]?.position || 0) + 1
            const { error } = await supabase.from('crm_pipeline_stages').insert({ company_id: COMPANY_ID, name, color: color || '#22c55e', position: nextPosition })
            if (error) action.data.error = error.message
            else action.data.created = true
          }

          if (action.type === 'create_customer') {
            const insertData = { ...action.data }
            delete insertData.created
            delete insertData.error
            const { error } = await supabase.from('crm_customers').insert({ company_id: COMPANY_ID, ...insertData })
            if (error) action.data.error = error.message
            else action.data.created = true
          }

          if (action.type === 'create_deal') {
            const insertData = { ...action.data }
            delete insertData.created
            delete insertData.error
            const { data: newCustomer } = await supabase.from('crm_customers').insert({
              company_id: COMPANY_ID,
              name: insertData.customer_name,
              email: insertData.customer_email || null,
              phone: insertData.customer_phone || null,
              moving_from: insertData.moving_from || null,
              moving_to: insertData.moving_to || null,
              moving_date: insertData.moving_date || null,
              notes: insertData.notes || null,
            }).select().single()
            const { error } = await supabase.from('crm_deals').insert({ company_id: COMPANY_ID, ...insertData, customer_id: newCustomer?.id || null })
            if (error) action.data.error = error.message
            else action.data.created = true
          }

          if (action.type === 'add_note') {
            const customerId = await getOrCreateCustomer(action.data.customer_name, action.data.customer_email)
            if (!customerId) {
              action.data.error = `Could not find or create customer: ${action.data.customer_name}`
            } else {
              const { error } = await supabase.from('crm_customer_notes').insert({
                company_id: COMPANY_ID,
                customer_id: customerId,
                note_text: action.data.note_text,
              })
              if (error) action.data.error = error.message
              else action.data.created = true
            }
          }

          if (action.type === 'add_task') {
            const customerId = await getOrCreateCustomer(action.data.customer_name)
            if (!customerId) {
              action.data.error = `Could not find customer: ${action.data.customer_name}`
            } else {
              const { error } = await supabase.from('crm_customer_tasks').insert({
                company_id: COMPANY_ID,
                customer_id: customerId,
                title: action.data.title,
                due_date: action.data.due_date,
              })
              if (error) action.data.error = error.message
              else {
                action.data.created = true
                await logNote(customerId, `✅ AI added task: "${action.data.title}" — due ${new Date(action.data.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
              }
            }
          }

          if (action.type === 'send_email') {
            // Only log the note — actual sending is handled client-side after user confirms
            const customerId = await getOrCreateCustomer(action.data.to_name, action.data.to_email)
            if (customerId) {
              action.data.customer_id_found = customerId
            }
          }

          if (action.type === 'book_event') {
            if (action.data.customer_name) {
              const customerId = await getOrCreateCustomer(action.data.customer_name)
              if (customerId) {
                await logNote(customerId, `📅 AI booked ${action.data.event_type} — "${action.data.title}" on ${new Date(action.data.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${new Date(action.data.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)
              }
            }
          }

          if (action.type === 'edit_website') {
            try {
              const { data: websiteData } = await supabase
                .from('company_websites')
                .select('blocks, theme, custom_html')
                .eq('company_id', COMPANY_ID)
                .maybeSingle()

              let blocks: any[] = websiteData?.blocks || []
              let theme = websiteData?.theme || { primary_color: '#0a0f1c', accent_color: '#0F6E56' }
              let customHtml = websiteData?.custom_html || null

              const { action: wsAction, block_type, block_index, block_data, theme: newTheme, custom_html } = action.data

              const blockDefaults: Record<string, any> = {
                hero: { headline: 'Professional Removals', subheadline: 'Trusted, reliable removal services', cta_text: 'Get a Free Quote' },
                services: { title: 'Our Services', services: [{ title: 'House Removals', description: 'Full house moves' }] },
                quote_form: { title: 'Get a Free Quote', subtitle: 'Fill in your details below' },
                about: { title: 'About Us', body: 'Tell your company story here...', highlights: ['Fully insured'] },
                reviews: { title: 'Customer Reviews', reviews: [{ name: 'Happy Customer', text: 'Great service!', rating: 5 }] },
                coverage: { title: 'Areas We Cover', areas: ['Your area'] },
                contact: { title: 'Contact Us' },
                gallery: { title: 'Our Work', images: [] },
              }

              if (wsAction === 'update_block') {
                const idx = (block_index !== null && block_index !== undefined)
                  ? block_index
                  : blocks.findIndex((b: any) => b.type === block_type)
                if (idx !== -1) {
                  blocks[idx] = { ...blocks[idx], ...(block_data || {}) }
                  action.data.updated_index = idx
                } else {
                  action.data.error = `No ${block_type} block found`
                }
              }

              if (wsAction === 'add_block') {
                blocks.push({ type: block_type, ...(block_data || blockDefaults[block_type] || {}) })
                action.data.added = true
              }

              if (wsAction === 'remove_block') {
                const idx = (block_index !== null && block_index !== undefined)
                  ? block_index
                  : blocks.findIndex((b: any) => b.type === block_type)
                if (idx !== -1) {
                  blocks.splice(idx, 1)
                  action.data.removed = true
                } else {
                  action.data.error = `No ${block_type} block found`
                }
              }

              if (wsAction === 'update_theme' && newTheme) {
                theme = { ...theme, ...newTheme }
                action.data.theme_updated = true
              }

              if (wsAction === 'set_custom_html' && custom_html) {
                customHtml = custom_html
                action.data.html_set = true
              }

              if (wsAction === 'build_page') {
                // block_data is an array of fully populated blocks
                if (Array.isArray(block_data)) {
                  blocks = block_data
                  action.data.built = true
                } else {
                  action.data.error = 'No blocks returned from AI'
                }
              }

              if (wsAction === 'suggest_improvements') {
                // Read-only — just returns message, no DB write needed
                action.data.suggestions_only = true
              }

              if (wsAction === 'edit_html') {
                // AI returns modified HTML in custom_html field
                if (action.data.custom_html) {
                  customHtml = action.data.custom_html
                  action.data.html_set = true
                } else {
                  action.data.error = 'No HTML returned'
                }
              }

              if (!action.data.error && wsAction !== 'suggest_improvements') {
                const { error } = await supabase
                  .from('company_websites')
                  .update({ blocks, theme, custom_html: customHtml, updated_at: new Date().toISOString() })
                  .eq('company_id', COMPANY_ID)
                if (error) action.data.error = error.message
                else action.data.created = true
              }

            } catch (wsErr: any) {
              action.data.error = wsErr.message
            }
          }

          if (action.type === 'move_deal') {
            const { data: deal } = await supabase.from('crm_deals').select('customer_id, customer_name').eq('id', action.data.deal_id).maybeSingle()
            const customerId = deal?.customer_id || (deal?.customer_name ? await getOrCreateCustomer(deal.customer_name) : null)
            if (customerId) {
              await logNote(customerId, `🔀 AI moved deal to "${action.data.new_stage_name}" — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
            }
            const { error } = await supabase.from('crm_deals').update({ stage_id: action.data.new_stage_id, updated_at: new Date().toISOString() }).eq('id', action.data.deal_id)
            if (error) action.data.error = error.message
            else action.data.created = true
          }

        } catch (actionErr: any) {
          console.error(`Action ${action.type} failed:`, actionErr)
          action.data.error = actionErr.message
        }
      }
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('AI assistant error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.', actions: [], requires_confirm: false }, { status: 500 })
  }
}