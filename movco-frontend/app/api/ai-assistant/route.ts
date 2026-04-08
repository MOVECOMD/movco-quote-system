// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages } = body
    const isOnboarding = body.onboarding === true
    const COMPANY_ID = body.company_id
    if (!COMPANY_ID && !isOnboarding) {
      return NextResponse.json({ message: 'Missing company_id', actions: [], requires_confirm: false }, { status: 400 })
    }

    // ═══════════════════════════════════════
    // ONBOARDING MODE
    // ═══════════════════════════════════════
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

Keep responses short and friendly. One question at a time. Always return valid JSON with at least a message field.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: onboardingPrompt, messages: messages.map((m: any) => ({ role: m.role, content: m.content })) }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      let parsed
      try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch {
        try { const f = text.indexOf('{'), l = text.lastIndexOf('}'); parsed = f !== -1 && l > f ? JSON.parse(text.substring(f, l + 1)) : { message: text, onboarding_complete: false } } catch { parsed = { message: text, onboarding_complete: false } }
      }
      return NextResponse.json(parsed)
    }

    // ═══════════════════════════════════════
    // LOAD ALL CONTEXT
    // ═══════════════════════════════════════
    const { data: companyData } = await supabase.from('companies').select('*').eq('id', COMPANY_ID).maybeSingle()
    const templateType = companyData?.template_type || 'removals'
    const companyName = companyData?.company_name || companyData?.name || 'the company'
    const { data: templateConfig } = await supabase.from('template_configs').select('terminology, feature_flags, label, ai_prompt_context').eq('template_type', templateType).maybeSingle()
    const terminology = templateConfig?.terminology || {}
    const featureFlags = templateConfig?.feature_flags || {}
    const industryLabel = templateConfig?.label || 'Business'
    const industryContext = templateConfig?.ai_prompt_context || 'General business.'

    const [dealsRes, customersRes, eventsRes, pipelinesRes, stagesRes, tasksRes, quotesRes, websiteRes, mediaRes, configRes, socialRes, automationsRes] = await Promise.all([
      supabase.from('crm_deals').select('id, customer_name, customer_email, customer_phone, stage_id, moving_date, estimated_value, moving_from, moving_to, notes, customer_id, created_at').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('crm_customers').select('id, name, email, phone, address, moving_from, moving_to, moving_date, notes, source, created_at').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(100),
      supabase.from('crm_diary_events').select('id, title, start_time, end_time, event_type, customer_name, location, completed, deal_id, description, color').eq('company_id', COMPANY_ID).order('start_time', { ascending: true }).limit(50),
      supabase.from('crm_pipelines').select('id, name, color, position, is_default').eq('company_id', COMPANY_ID).order('position'),
      supabase.from('crm_pipeline_stages').select('id, name, color, position, pipeline_id').eq('company_id', COMPANY_ID).order('position'),
      supabase.from('crm_customer_tasks').select('id, customer_id, title, due_date, completed').eq('company_id', COMPANY_ID).order('due_date', { ascending: true }).limit(50),
      supabase.from('crm_quotes').select('id, customer_name, customer_email, customer_phone, estimated_price, status, deal_id, created_at, moving_date, items, notes').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(20),
      supabase.from('company_websites').select('blocks, theme, custom_html, slug, published, custom_domain').eq('company_id', COMPANY_ID).maybeSingle(),
      supabase.from('media_library').select('id, name, url, type').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(30),
      supabase.from('company_config').select('custom_event_types, custom_customer_fields').eq('company_id', COMPANY_ID).maybeSingle(),
      supabase.from('social_posts').select('id, content, platforms, status, scheduled_at, posted_at').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(20),
      supabase.from('automation_sequences').select('*, automation_steps(*)').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }).limit(20),
    ])

    const allPipelines = pipelinesRes.data || []
    const stages = stagesRes.data || []
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Stats
    const thisMonth = today.getMonth(), thisYear = today.getFullYear()
    const completedJobsThisMonth = eventsRes.data?.filter(e => { if (!e.completed || e.event_type !== 'job') return false; const d = new Date(e.start_time); return d.getMonth() === thisMonth && d.getFullYear() === thisYear }) || []
    const dealsWithCompletedJobs = dealsRes.data?.filter(d => completedJobsThisMonth.some(e => e.deal_id === d.id)) || []
    const revenueThisMonth = dealsWithCompletedJobs.reduce((s, d) => s + (d.estimated_value || 0), 0)
    const pipelineByStage = stages.map(stage => ({ stage: stage.name, count: dealsRes.data?.filter(d => d.stage_id === stage.id).length || 0, value: dealsRes.data?.filter(d => d.stage_id === stage.id).reduce((s, d) => s + (d.estimated_value || 0), 0) || 0 }))
    const overdueTasks = tasksRes.data?.filter(t => !t.completed && new Date(t.due_date) < today) || []
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
    const upcomingJobs = eventsRes.data?.filter(e => { if (e.event_type !== 'job' || e.completed) return false; const d = new Date(e.start_time); return d >= today && d <= weekEnd }) || []
    const totalDeals = dealsRes.data?.length || 0
    const totalCustomers = customersRes.data?.length || 0
    const avgDealValue = totalDeals > 0 ? Math.round((dealsRes.data?.reduce((s, d) => s + (d.estimated_value || 0), 0) || 0) / totalDeals) : 0
    const quotesThisMonth = quotesRes.data?.filter(q => { const d = new Date(q.created_at); return d.getMonth() === thisMonth && d.getFullYear() === thisYear }) || []
    const acceptedQuotes = quotesRes.data?.filter(q => q.status === 'accepted') || []
    const conversionRate = quotesRes.data && quotesRes.data.length > 0 ? Math.round((acceptedQuotes.length / quotesRes.data.length) * 100) : 0

    // ═══════════════════════════════════════
    // SYSTEM PROMPT
    // ═══════════════════════════════════════
    const systemPrompt = `You are an AI assistant built into BuildYourManagement (BYM), a multi-industry CRM platform. You are currently helping "${companyName}", which is a ${industryLabel} business. ${industryContext}

INDUSTRY: ${templateType} (${industryLabel})
TERMINOLOGY: ${JSON.stringify(terminology)}
Use the terminology above when referring to CRM concepts — say "${terminology.customers || 'Customers'}" not "customers", "${terminology.deals || 'Deals'}" not "deals", "${terminology.diary || 'Diary'}" not "diary", "${terminology.quotes || 'Quotes'}" not "quotes".

FEATURE FLAGS: ${JSON.stringify(featureFlags)}
Only suggest features that are enabled.

Today's date: ${todayStr}
Company info: name=${companyName}, email=${companyData?.email || 'not set'}, phone=${companyData?.phone || 'not set'}, address=${companyData?.address || 'not set'}

LIVE CRM DATA:
Pipelines: ${JSON.stringify(allPipelines)}
Stages: ${JSON.stringify(stages)}
Deals (${totalDeals}): ${JSON.stringify(dealsRes.data || [])}
Customers (${totalCustomers}): ${JSON.stringify(customersRes.data?.slice(0, 50) || [])}
Events: ${JSON.stringify(eventsRes.data || [])}
Quotes: ${JSON.stringify(quotesRes.data || [])}
Tasks: ${JSON.stringify(tasksRes.data?.slice(0, 30) || [])}
Social posts: ${JSON.stringify(socialRes.data?.slice(0, 10) || [])}
Automations: ${JSON.stringify((automationsRes.data || []).map((a: any) => ({ id: a.id, name: a.name, trigger: a.trigger_type, active: a.active, steps: (a.automation_steps || []).length })))}
Event types config: ${JSON.stringify(configRes.data?.custom_event_types || [])}
Custom fields config: ${JSON.stringify(configRes.data?.custom_customer_fields || [])}
Website: slug=${websiteRes.data?.slug || 'none'}, published=${websiteRes.data?.published || false}, has_custom_html=${!!websiteRes.data?.custom_html}
Website blocks: ${JSON.stringify(websiteRes.data?.blocks || [])}
Media: ${JSON.stringify((mediaRes.data || []).map((m: any) => ({ name: m.name, url: m.url })))}

STATS:
Revenue this month: £${revenueThisMonth.toLocaleString()} (${completedJobsThisMonth.length} completed)
Pipeline by stage: ${JSON.stringify(pipelineByStage)}
Overdue tasks: ${overdueTasks.length}
Upcoming this week: ${upcomingJobs.length}
Average deal value: £${avgDealValue}
Quote conversion rate: ${conversionRate}%
Quotes this month: ${quotesThisMonth.length}

Return ONLY raw JSON:
{
  "message": "Short friendly response",
  "actions": [ ... ],
  "requires_confirm": true | false
}

═══ ALL ACTION TYPES ═══

CUSTOMER ACTIONS:
create_customer: { "type": "create_customer", "data": { "name": "x", "email": "x", "phone": "x", "address": "x", "notes": "x" } }
edit_customer: { "type": "edit_customer", "data": { "customer_id": "uuid", "customer_name": "x", "updates": { "name": "x", "email": "x", "phone": "x", "address": "x", "notes": "x" } } }
delete_customer: { "type": "delete_customer", "data": { "customer_id": "uuid", "customer_name": "x" } }
merge_customers: { "type": "merge_customers", "data": { "keep_id": "uuid", "merge_id": "uuid", "keep_name": "x", "merge_name": "x" } }

DEAL ACTIONS:
create_deal: { "type": "create_deal", "data": { "customer_name": "x", "customer_email": "x", "customer_phone": "x", "stage_id": "uuid", "estimated_value": 0, "notes": "x" } }
edit_deal: { "type": "edit_deal", "data": { "deal_id": "uuid", "deal_name": "x", "updates": { "customer_name": "x", "estimated_value": 0, "notes": "x", "moving_from": "x", "moving_to": "x", "moving_date": "ISO" } } }
delete_deal: { "type": "delete_deal", "data": { "deal_id": "uuid", "deal_name": "x" } }
move_deal: { "type": "move_deal", "data": { "deal_id": "uuid", "deal_name": "x", "new_stage_id": "uuid", "new_stage_name": "x" } }

PIPELINE ACTIONS:
create_pipeline: { "type": "create_pipeline", "data": { "name": "x", "color": "#hex" } }
create_pipeline_stage: { "type": "create_pipeline_stage", "data": { "name": "x", "color": "#hex", "pipeline_id": "uuid" } }
edit_stage: { "type": "edit_stage", "data": { "stage_id": "uuid", "updates": { "name": "x", "color": "#hex", "position": 0 } } }
delete_stage: { "type": "delete_stage", "data": { "stage_id": "uuid", "stage_name": "x" } }
edit_pipeline: { "type": "edit_pipeline", "data": { "pipeline_id": "uuid", "updates": { "name": "x", "color": "#hex" } } }
delete_pipeline: { "type": "delete_pipeline", "data": { "pipeline_id": "uuid", "pipeline_name": "x" } }

TASK ACTIONS:
add_task: { "type": "add_task", "data": { "customer_id": "uuid", "customer_name": "x", "title": "x", "due_date": "ISO" } }
complete_task: { "type": "complete_task", "data": { "task_id": "uuid", "task_title": "x" } }
delete_task: { "type": "delete_task", "data": { "task_id": "uuid", "task_title": "x" } }
add_note: { "type": "add_note", "data": { "customer_id": "uuid", "customer_name": "x", "note_text": "x" } }

EVENT ACTIONS:
book_event: { "type": "book_event", "data": { "title": "x", "event_type": "x", "start_time": "ISO", "end_time": "ISO", "customer_name": "x", "location": "x", "deal_id": "uuid" } }
edit_event: { "type": "edit_event", "data": { "event_id": "uuid", "event_title": "x", "updates": { "title": "x", "start_time": "ISO", "end_time": "ISO", "event_type": "x", "customer_name": "x", "location": "x" } } }
delete_event: { "type": "delete_event", "data": { "event_id": "uuid", "event_title": "x" } }
complete_event: { "type": "complete_event", "data": { "event_id": "uuid", "event_title": "x" } }

QUOTE ACTIONS:
create_quote: { "type": "create_quote", "data": { "customer_name": "x", "customer_email": "x", "customer_phone": "x", "items": [{"name": "x", "quantity": 1, "unit_price": 0, "note": "x"}], "estimated_price": 0, "notes": "x", "status": "draft" } }
edit_quote: { "type": "edit_quote", "data": { "quote_id": "uuid", "updates": { "estimated_price": 0, "status": "x", "notes": "x", "items": [] } } }
update_quote_status: { "type": "update_quote_status", "data": { "quote_id": "uuid", "customer_name": "x", "new_status": "draft|sent|accepted|declined" } }
send_quote_email: { "type": "send_quote_email", "data": { "quote_id": "uuid", "customer_name": "x", "customer_email": "x", "subject": "x", "body": "x" } }
convert_quote_to_deal: { "type": "convert_quote_to_deal", "data": { "quote_id": "uuid", "customer_name": "x", "stage_id": "uuid", "estimated_value": 0 } }

EMAIL ACTIONS:
send_email: { "type": "send_email", "data": { "to_email": "x", "to_name": "x", "subject": "x", "body": "x" } }
bulk_email: { "type": "bulk_email", "data": { "recipients": [{"name": "x", "email": "x"}], "subject": "x", "body_template": "x" } }
create_email_template: { "type": "create_email_template", "data": { "name": "x", "subject": "x", "body": "x" } }

SOCIAL ACTIONS:
schedule_post: { "type": "schedule_post", "data": { "content": "x", "platforms": ["facebook"], "scheduled_at": "ISO" } }
edit_social_post: { "type": "edit_social_post", "data": { "post_id": "uuid", "updates": { "content": "x", "scheduled_at": "ISO" } } }
delete_social_post: { "type": "delete_social_post", "data": { "post_id": "uuid" } }

WEBSITE ACTIONS:
edit_website: { "type": "edit_website", "data": { "action": "update_block|add_block|remove_block|update_theme|edit_html|build_page|suggest_improvements", ... } }
publish_website: { "type": "publish_website", "data": { "published": true|false } }
update_website_settings: { "type": "update_website_settings", "data": { "slug": "x", "custom_domain": "x" } }

CRM CONFIGURATION:
update_event_types: { "type": "update_event_types", "data": { "action": "add|remove|rename", "key": "x", "label": "x", "color": "#hex" } }
update_customer_fields: { "type": "update_customer_fields", "data": { "action": "add|remove", "key": "x", "label": "x", "type": "text|number|date|textarea|select", "options": [] } }
update_terminology: { "type": "update_terminology", "data": { "updates": { "customers": "New Label", "deals": "New Label", "diary": "New Label", "quotes": "New Label", "pipeline": "New Label", "leads": "New Label", "reports": "New Label" } } }
toggle_feature_flag: { "type": "toggle_feature_flag", "data": { "flag": "show_quote_builder|show_coverage_postcodes|show_day_plan|show_invoice", "enabled": true|false } }
change_industry: { "type": "change_industry", "data": { "new_template_type": "plumber|electrician|etc", "reseed": true|false } }

COMPANY SETTINGS:
update_company: { "type": "update_company", "data": { "updates": { "name": "x", "email": "x", "phone": "x", "address": "x" } } }
update_coverage: { "type": "update_coverage", "data": { "postcodes": ["AB1", "AB2"] } }
update_working_hours: { "type": "update_working_hours", "data": { "hours": { "monday": {"start": "09:00", "end": "17:00"}, "tuesday": {"start": "09:00", "end": "17:00"} } } }
AUTOMATION ACTIONS:
create_automation: { "type": "create_automation", "data": { "name": "Welcome email on new lead", "description": "Sends welcome email when a new deal is created", "trigger_type": "new_deal|stage_change|quote_sent|quote_accepted|quote_declined|days_before_move|no_response|manual", "trigger_config": { "stage_id": "uuid (for stage_change)", "days_before": 3, "days_without_response": 3 }, "action_type": "send_email", "action_config": { "subject": "Welcome!", "body": "Hi {name}, thanks for your enquiry..." }, "steps": [{"step_type": "send_email", "config": {"subject": "x", "body": "x"}, "delay_value": 0, "delay_unit": "hours"}] } }
edit_automation: { "type": "edit_automation", "data": { "automation_id": "uuid", "updates": { "name": "x", "active": true } } }
delete_automation: { "type": "delete_automation", "data": { "automation_id": "uuid", "automation_name": "x" } }
toggle_automation: { "type": "toggle_automation", "data": { "automation_id": "uuid", "automation_name": "x", "enabled": true|false } }
Variables for email/message templates: {name}, {email}, {phone}, {moving_from}, {moving_to}, {moving_date}, {value}, {notes}
For single-step automations use action_type + action_config. For multi-step use the steps array.
REPORTING (answer type — no action needed):
answer: { "type": "answer", "data": { "summary": "x" } }
For reporting queries (conversion rate, average deal value, customer lifetime value, etc), compute from the data above and return as answer type.

═══ RULES ═══
- ALWAYS use real IDs from data above — never invent IDs
- When creating stages, always include pipeline_id
- Match customers/deals by name fuzzy — "John" matches "John Smith"
- ALWAYS set requires_confirm: true when there are ANY actions (except server-side-only: create_customer, create_deal, add_note, add_task, create_pipeline, create_pipeline_stage, update_event_types, update_customer_fields, edit_customer, delete_customer, merge_customers, edit_deal, delete_deal, edit_stage, delete_stage, edit_pipeline, delete_pipeline, complete_task, delete_task, edit_event, delete_event, complete_event, create_quote, edit_quote, update_quote_status, convert_quote_to_deal, edit_social_post, delete_social_post, publish_website, update_website_settings, update_terminology, toggle_feature_flag, change_industry, update_company, update_coverage, update_working_hours, create_email_template, create_automation, edit_automation, delete_automation, toggle_automation)
- For ALL the server-side actions above, set requires_confirm: false — they execute immediately
- For send_email, book_event, move_deal, schedule_post, send_quote_email: requires_confirm: true
- Keep message to 1-2 short sentences. No bullet points, no bold, no lists.
- Use the industry TERMINOLOGY from above
- Never mention removals/moving/vans unless the company IS a removal company
- Return ONLY raw JSON — no markdown, no backticks
- When the website has custom HTML, use edit_html for ALL website changes
- When asked to "build a website", use build_page and generate ALL appropriate blocks`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, system: systemPrompt, messages: messages.map((m: any) => ({ role: m.role, content: m.content })) }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'
    let parsed
    try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch {
      try { const f = text.indexOf('{'), l = text.lastIndexOf('}'); parsed = f !== -1 && l > f ? JSON.parse(text.substring(f, l + 1)) : { message: text.replace(/[{}"\\]/g, ' ').substring(0, 300).trim(), actions: [], requires_confirm: false } } catch { parsed = { message: text.replace(/[{}"\\]/g, ' ').substring(0, 300).trim(), actions: [], requires_confirm: false } }
    }

    // ═══════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════
    const getOrCreateCustomer = async (customerName: string, customerEmail?: string): Promise<string | null> => {
      if (customerEmail) { const { data } = await supabase.from('crm_customers').select('id').eq('company_id', COMPANY_ID).ilike('email', customerEmail).maybeSingle(); if (data?.id) return data.id }
      const { data: byName } = await supabase.from('crm_customers').select('id').eq('company_id', COMPANY_ID).ilike('name', `%${customerName}%`).maybeSingle()
      if (byName?.id) return byName.id
      const { data: deal } = await supabase.from('crm_deals').select('id, customer_id, customer_name, customer_email, customer_phone, moving_from, moving_to, moving_date, notes').eq('company_id', COMPANY_ID).ilike('customer_name', `%${customerName}%`).maybeSingle()
      if (deal?.customer_id) return deal.customer_id
      const { data: nc } = await supabase.from('crm_customers').insert({ company_id: COMPANY_ID, name: deal?.customer_name || customerName, email: deal?.customer_email || customerEmail || null, phone: deal?.customer_phone || null }).select().single()
      if (nc?.id && deal?.id) await supabase.from('crm_deals').update({ customer_id: nc.id }).eq('id', deal.id)
      return nc?.id || null
    }

    const logNote = async (customerId: string, noteText: string) => {
      await supabase.from('crm_customer_notes').insert({ company_id: COMPANY_ID, customer_id: customerId, note_text: noteText })
    }

    // ═══════════════════════════════════════
    // EXECUTE ALL SERVER-SIDE ACTIONS
    // ═══════════════════════════════════════
    if (parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        try {

          // ── CUSTOMER ACTIONS ──
          if (action.type === 'create_customer') {
            const d = { ...action.data }; delete d.created; delete d.error
            const { error } = await supabase.from('crm_customers').insert({ company_id: COMPANY_ID, ...d })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'edit_customer') {
            const { customer_id, updates } = action.data
            if (!customer_id) { action.data.error = 'No customer ID provided'; continue }
            const { error } = await supabase.from('crm_customers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', customer_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_customer') {
            const { customer_id } = action.data
            await supabase.from('crm_customer_notes').delete().eq('customer_id', customer_id)
            await supabase.from('crm_customer_tasks').delete().eq('customer_id', customer_id)
            const { error } = await supabase.from('crm_customers').delete().eq('id', customer_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          if (action.type === 'merge_customers') {
            const { keep_id, merge_id } = action.data
            await supabase.from('crm_deals').update({ customer_id: keep_id }).eq('customer_id', merge_id).eq('company_id', COMPANY_ID)
            await supabase.from('crm_customer_notes').update({ customer_id: keep_id }).eq('customer_id', merge_id)
            await supabase.from('crm_customer_tasks').update({ customer_id: keep_id }).eq('customer_id', merge_id)
            await supabase.from('crm_customers').delete().eq('id', merge_id).eq('company_id', COMPANY_ID)
            action.data.merged = true
          }

          // ── DEAL ACTIONS ──
          if (action.type === 'create_deal') {
            const d = { ...action.data }; delete d.created; delete d.error
            const { data: nc } = await supabase.from('crm_customers').insert({ company_id: COMPANY_ID, name: d.customer_name, email: d.customer_email || null, phone: d.customer_phone || null, moving_from: d.moving_from || null, moving_to: d.moving_to || null, moving_date: d.moving_date || null, notes: d.notes || null }).select().single()
            const { error } = await supabase.from('crm_deals').insert({ company_id: COMPANY_ID, ...d, customer_id: nc?.id || null })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'edit_deal') {
            const { deal_id, updates } = action.data
            const { error } = await supabase.from('crm_deals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', deal_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_deal') {
            const { deal_id } = action.data
            const { error } = await supabase.from('crm_deals').delete().eq('id', deal_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          if (action.type === 'move_deal') {
            const { deal_id, new_stage_id } = action.data
            const { error } = await supabase.from('crm_deals').update({ stage_id: new_stage_id, updated_at: new Date().toISOString() }).eq('id', deal_id)
            if (error) action.data.error = error.message; else action.data.created = true
            const { data: deal } = await supabase.from('crm_deals').select('customer_id, customer_name').eq('id', deal_id).maybeSingle()
            if (deal?.customer_id || deal?.customer_name) {
              const cid = deal.customer_id || await getOrCreateCustomer(deal.customer_name)
              if (cid) await logNote(cid, `🔀 Moved to "${action.data.new_stage_name}"`)
            }
          }

          // ── PIPELINE ACTIONS ──
          if (action.type === 'create_pipeline') {
            const { name, color } = action.data
            const maxPos = allPipelines.length > 0 ? Math.max(...allPipelines.map((p: any) => p.position)) : 0
            const { error } = await supabase.from('crm_pipelines').insert({ company_id: COMPANY_ID, name, color: color || '#3b82f6', position: maxPos + 1, is_default: allPipelines.length === 0 }).select().single()
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'create_pipeline_stage') {
            const { name, color, pipeline_id } = action.data
            const pid = pipeline_id || allPipelines.find((p: any) => p.is_default)?.id || allPipelines[0]?.id
            const { data: es } = await supabase.from('crm_pipeline_stages').select('position').eq('company_id', COMPANY_ID).eq('pipeline_id', pid).order('position', { ascending: false }).limit(1)
            const { error } = await supabase.from('crm_pipeline_stages').insert({ company_id: COMPANY_ID, pipeline_id: pid, name, color: color || '#22c55e', position: (es?.[0]?.position || 0) + 1 })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'edit_stage') {
            const { stage_id, updates } = action.data
            const { error } = await supabase.from('crm_pipeline_stages').update(updates).eq('id', stage_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_stage') {
            const { stage_id } = action.data
            const { data: dealsInStage } = await supabase.from('crm_deals').select('id').eq('stage_id', stage_id).eq('company_id', COMPANY_ID).limit(1)
            if (dealsInStage && dealsInStage.length > 0) { action.data.error = 'Cannot delete — there are deals in this stage. Move them first.'; continue }
            const { error } = await supabase.from('crm_pipeline_stages').delete().eq('id', stage_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          if (action.type === 'edit_pipeline') {
            const { pipeline_id, updates } = action.data
            const { error } = await supabase.from('crm_pipelines').update(updates).eq('id', pipeline_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_pipeline') {
            const { pipeline_id } = action.data
            await supabase.from('crm_pipeline_stages').delete().eq('pipeline_id', pipeline_id).eq('company_id', COMPANY_ID)
            const { error } = await supabase.from('crm_pipelines').delete().eq('id', pipeline_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          // ── TASK ACTIONS ──
          if (action.type === 'add_task') {
            const cid = await getOrCreateCustomer(action.data.customer_name)
            if (!cid) { action.data.error = `Could not find customer: ${action.data.customer_name}`; continue }
            const { error } = await supabase.from('crm_customer_tasks').insert({ company_id: COMPANY_ID, customer_id: cid, title: action.data.title, due_date: action.data.due_date })
            if (error) action.data.error = error.message; else { action.data.created = true; await logNote(cid, `✅ Task: "${action.data.title}"`) }
          }

          if (action.type === 'complete_task') {
            const { task_id } = action.data
            const { error } = await supabase.from('crm_customer_tasks').update({ completed: true }).eq('id', task_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.completed = true
          }

          if (action.type === 'delete_task') {
            const { task_id } = action.data
            const { error } = await supabase.from('crm_customer_tasks').delete().eq('id', task_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          if (action.type === 'add_note') {
            const cid = await getOrCreateCustomer(action.data.customer_name, action.data.customer_email)
            if (!cid) { action.data.error = `Could not find customer: ${action.data.customer_name}`; continue }
            const { error } = await supabase.from('crm_customer_notes').insert({ company_id: COMPANY_ID, customer_id: cid, note_text: action.data.note_text })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          // ── EVENT ACTIONS ──
          if (action.type === 'book_event') {
            if (action.data.customer_name) {
              const cid = await getOrCreateCustomer(action.data.customer_name)
              if (cid) await logNote(cid, `📅 Booked: "${action.data.title}" on ${new Date(action.data.start_time).toLocaleDateString('en-GB')}`)
            }
          }

          if (action.type === 'edit_event') {
            const { event_id, updates } = action.data
            const { error } = await supabase.from('crm_diary_events').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', event_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_event') {
            const { event_id } = action.data
            const { error } = await supabase.from('crm_diary_events').delete().eq('id', event_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          if (action.type === 'complete_event') {
            const { event_id } = action.data
            const { error } = await supabase.from('crm_diary_events').update({ completed: true }).eq('id', event_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.completed = true
          }

          // ── QUOTE ACTIONS ──
          if (action.type === 'create_quote') {
            const d = action.data
            const { error } = await supabase.from('crm_quotes').insert({
              company_id: COMPANY_ID, customer_name: d.customer_name, customer_email: d.customer_email || null,
              customer_phone: d.customer_phone || null, items: d.items || [], estimated_price: d.estimated_price || 0,
              notes: d.notes || null, status: d.status || 'draft', total_volume_m3: 0, van_count: 0, movers: 0,
            })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'edit_quote') {
            const { quote_id, updates } = action.data
            const { error } = await supabase.from('crm_quotes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', quote_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'update_quote_status') {
            const { quote_id, new_status } = action.data
            const { error } = await supabase.from('crm_quotes').update({ status: new_status, updated_at: new Date().toISOString() }).eq('id', quote_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'send_quote_email') {
            // This requires confirmation — handled client-side like send_email
          }

          if (action.type === 'convert_quote_to_deal') {
            const d = action.data
            const { data: quote } = await supabase.from('crm_quotes').select('*').eq('id', d.quote_id).eq('company_id', COMPANY_ID).maybeSingle()
            if (!quote) { action.data.error = 'Quote not found'; continue }
            const { error } = await supabase.from('crm_deals').insert({
              company_id: COMPANY_ID, customer_name: quote.customer_name, customer_email: quote.customer_email,
              customer_phone: quote.customer_phone, estimated_value: quote.estimated_price || d.estimated_value || 0,
              stage_id: d.stage_id, notes: `Converted from quote #${quote.id}`, moving_from: quote.moving_from, moving_to: quote.moving_to, moving_date: quote.moving_date,
            })
            if (!error) await supabase.from('crm_quotes').update({ status: 'accepted' }).eq('id', d.quote_id)
            if (error) action.data.error = error.message; else action.data.converted = true
          }

          // ── EMAIL ACTIONS ──
          if (action.type === 'send_email') {
            const cid = await getOrCreateCustomer(action.data.to_name, action.data.to_email)
            if (cid) await logNote(cid, `📧 Email: "${action.data.subject}"`)
          }

          if (action.type === 'bulk_email') {
            // Executed server-side — send each email
            const results: string[] = []
            for (const r of (action.data.recipients || [])) {
              try {
                const emailRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://movco-quote-system.vercel.app'}/api/email/send-custom`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ company_id: COMPANY_ID, recipient_email: r.email, recipient_name: r.name, subject: action.data.subject, body_text: action.data.body_template.replace('{{name}}', r.name) }),
                })
                results.push(`✓ ${r.name}`)
              } catch { results.push(`✗ ${r.name}`) }
            }
            action.data.results = results; action.data.sent = true
          }

          if (action.type === 'create_email_template') {
            // Store in company_config or separate table
            const { data: cfg } = await supabase.from('company_config').select('email_templates').eq('company_id', COMPANY_ID).maybeSingle()
            const templates = cfg?.email_templates || []
            templates.push({ name: action.data.name, subject: action.data.subject, body: action.data.body, created_at: new Date().toISOString() })
            const { error } = await supabase.from('company_config').upsert({ company_id: COMPANY_ID, email_templates: templates }, { onConflict: 'company_id' })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          // ── SOCIAL ACTIONS ──
          if (action.type === 'edit_social_post') {
            const { post_id, updates } = action.data
            const { error } = await supabase.from('social_posts').update(updates).eq('id', post_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_social_post') {
            const { post_id } = action.data
            const { error } = await supabase.from('social_posts').delete().eq('id', post_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          // ── WEBSITE ACTIONS ──
          if (action.type === 'publish_website') {
            const { error } = await supabase.from('company_websites').update({ published: action.data.published, updated_at: new Date().toISOString() }).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'update_website_settings') {
            const updates: any = { updated_at: new Date().toISOString() }
            if (action.data.slug) updates.slug = action.data.slug
            if (action.data.custom_domain !== undefined) updates.custom_domain = action.data.custom_domain
            const { error } = await supabase.from('company_websites').update(updates).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          // ── CRM CONFIGURATION ──
          if (action.type === 'update_event_types') {
            const { data: cd } = await supabase.from('company_config').select('custom_event_types').eq('company_id', COMPANY_ID).maybeSingle()
            let types = cd?.custom_event_types || []
            if (action.data.action === 'add') { const key = action.data.key || action.data.label.toLowerCase().replace(/[^a-z0-9]/g, '_'); if (!types.some((t: any) => t.key === key)) types.push({ key, label: action.data.label, color: action.data.color || '#6b7280' }) }
            else if (action.data.action === 'remove') types = types.filter((t: any) => t.key !== action.data.key)
            else if (action.data.action === 'rename') types = types.map((t: any) => t.key === action.data.key ? { ...t, label: action.data.new_label || action.data.label } : t)
            const { error } = await supabase.from('company_config').upsert({ company_id: COMPANY_ID, custom_event_types: types }, { onConflict: 'company_id' })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'update_customer_fields') {
            const { data: cd } = await supabase.from('company_config').select('custom_customer_fields').eq('company_id', COMPANY_ID).maybeSingle()
            let fields = cd?.custom_customer_fields || []
            if (action.data.action === 'add') { const key = action.data.key || action.data.label.toLowerCase().replace(/[^a-z0-9]/g, '_'); if (!fields.some((f: any) => f.key === key)) { const f: any = { key, label: action.data.label, type: action.data.type || 'text' }; if (action.data.options) f.options = action.data.options; fields.push(f) } }
            else if (action.data.action === 'remove') fields = fields.filter((f: any) => f.key !== action.data.key)
            const { error } = await supabase.from('company_config').upsert({ company_id: COMPANY_ID, custom_customer_fields: fields }, { onConflict: 'company_id' })
            if (error) action.data.error = error.message; else action.data.created = true
          }

          if (action.type === 'update_terminology') {
            const { updates } = action.data
            const { data: tc } = await supabase.from('template_configs').select('terminology').eq('template_type', templateType).maybeSingle()
            const merged = { ...(tc?.terminology || {}), ...updates }
            const { error } = await supabase.from('template_configs').update({ terminology: merged }).eq('template_type', templateType)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'toggle_feature_flag') {
            const { flag, enabled } = action.data
            const { data: tc } = await supabase.from('template_configs').select('feature_flags').eq('template_type', templateType).maybeSingle()
            const flags = { ...(tc?.feature_flags || {}), [flag]: enabled }
            const { error } = await supabase.from('template_configs').update({ feature_flags: flags }).eq('template_type', templateType)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'change_industry') {
  let { new_template_type, reseed } = action.data
  // Fix common aliases
  const aliasMap: Record<string, string> = { dentist: 'dental', veterinary: 'vet', lawyer: 'solicitor', hairdresser: 'salon', barbershop: 'barber', physiotherapist: 'physio', garage: 'mechanic' }
  if (aliasMap[new_template_type]) new_template_type = aliasMap[new_template_type]
            const { error } = await supabase.from('companies').update({ template_type: new_template_type }).eq('id', COMPANY_ID)
            if (error) { action.data.error = error.message; continue }
            if (reseed) {
              try {
                await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://movco-quote-system.vercel.app'}/api/seed-company`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ company_id: COMPANY_ID, template_type: new_template_type }),
                })
              } catch {}
            }
            action.data.changed = true
          }
// ── AUTOMATION ACTIONS ──
          if (action.type === 'create_automation') {
            const d = action.data
            const { data: seq, error: seqErr } = await supabase.from('automation_sequences').insert({
              company_id: COMPANY_ID,
              name: d.name,
              description: d.description || null,
              trigger_type: d.trigger_type,
              trigger_config: d.trigger_config || {},
              active: true,
            }).select().single()
            if (seqErr) { action.data.error = seqErr.message; } else {
              // Insert steps
              const steps = (d.steps || []).map((s: any, i: number) => ({
                sequence_id: seq.id,
                step_type: s.step_type || s.action_type || 'send_email',
                config: s.config || s.action_config || {},
                delay_value: s.delay_value || (i === 0 ? 0 : 1),
                delay_unit: s.delay_unit || 'hours',
                position: i,
              }))
              if (steps.length > 0) {
                await supabase.from('automation_steps').insert(steps)
              } else if (d.action_type) {
                // Single-step shorthand
                await supabase.from('automation_steps').insert({
                  sequence_id: seq.id,
                  step_type: d.action_type,
                  config: d.action_config || {},
                  delay_value: 0,
                  delay_unit: 'hours',
                  position: 0,
                })
              }
              action.data.created = true
            }
          }

          if (action.type === 'edit_automation') {
            const { automation_id, updates } = action.data
            const { error } = await supabase.from('automation_sequences').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', automation_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'delete_automation') {
            const { automation_id } = action.data
            await supabase.from('automation_enrollments').delete().eq('sequence_id', automation_id)
            await supabase.from('automation_steps').delete().eq('sequence_id', automation_id)
            await supabase.from('automation_logs').delete().eq('sequence_id', automation_id)
            const { error } = await supabase.from('automation_sequences').delete().eq('id', automation_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.deleted = true
          }

          if (action.type === 'toggle_automation') {
            const { automation_id, enabled } = action.data
            const { error } = await supabase.from('automation_sequences').update({ active: enabled }).eq('id', automation_id).eq('company_id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }
          // ── COMPANY SETTINGS ──
          if (action.type === 'update_company') {
            const { updates } = action.data
            const { error } = await supabase.from('companies').update(updates).eq('id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'update_coverage') {
            const { postcodes } = action.data
            const { error } = await supabase.from('companies').update({ coverage_postcodes: postcodes }).eq('id', COMPANY_ID)
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          if (action.type === 'update_working_hours') {
            const { hours } = action.data
            const { error } = await supabase.from('company_config').upsert({ company_id: COMPANY_ID, working_hours: hours }, { onConflict: 'company_id' })
            if (error) action.data.error = error.message; else action.data.updated = true
          }

          // ── WEBSITE EDIT (complex — keep existing logic) ──
          if (action.type === 'edit_website') {
            try {
              const { data: wd } = await supabase.from('company_websites').select('blocks, theme, custom_html, undo_snapshot').eq('company_id', COMPANY_ID).maybeSingle()
              let blocks: any[] = wd?.blocks || []
              let theme = wd?.theme || { primary_color: '#0a0f1c', accent_color: '#0F6E56' }
              let customHtml = wd?.custom_html || null
              const undoSnapshot = { blocks: JSON.parse(JSON.stringify(blocks)), theme: JSON.parse(JSON.stringify(theme)), custom_html: customHtml, timestamp: new Date().toISOString(), description: messages[messages.length - 1]?.content || 'AI edit' }

              const { action: wsAction, block_type, block_index, block_data, theme: newTheme } = action.data
              const blockDefaults: Record<string, any> = {
                hero: { headline: 'Welcome', subheadline: 'Professional services', cta_text: 'Get in Touch' },
                services: { title: 'Our Services', services: [{ title: 'Service 1', description: 'Description' }] },
                quote_form: { title: 'Get a Quote', subtitle: 'Fill in your details' },
                about: { title: 'About Us', body: 'Your story here...', highlights: ['Highlight 1'] },
                reviews: { title: 'Reviews', reviews: [{ name: 'Customer', text: 'Great service!', rating: 5 }] },
                coverage: { title: 'Areas We Cover', areas: ['Your area'] },
                contact: { title: 'Contact Us' },
                gallery: { title: 'Our Work', images: [] },
              }

              if (wsAction === 'update_block') {
                const idx = block_index ?? blocks.findIndex((b: any) => b.type === block_type)
                if (idx !== -1) { blocks[idx] = { ...blocks[idx], ...(block_data || {}) }; action.data.updated_index = idx } else action.data.error = `No "${block_type}" section found.`
              }
              if (wsAction === 'add_block') { blocks.push({ type: block_type, ...(block_data || blockDefaults[block_type] || {}) }); action.data.added = true }
              if (wsAction === 'remove_block') { const idx = block_index ?? blocks.findIndex((b: any) => b.type === block_type); if (idx !== -1) { blocks.splice(idx, 1); action.data.removed = true } else action.data.error = `No "${block_type}" section found.` }
              if (wsAction === 'update_theme' && newTheme) { theme = { ...theme, ...newTheme }; action.data.theme_updated = true }
              if (wsAction === 'build_page') { if (Array.isArray(block_data)) { blocks = block_data; action.data.built = true } else action.data.error = 'No blocks generated.' }
              if (wsAction === 'suggest_improvements') { action.data.suggestions_only = true }

              if (wsAction === 'edit_html') {
                const currentHtml = wd?.custom_html || ''
                if (!currentHtml) { action.data.error = 'No custom HTML yet. Try "build me a website" first.'; } else {
                  const mediaList = (mediaRes.data || []).map((m: any) => ({ name: m.name, url: m.url }))
                  const htmlRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
                    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, system: `You are an HTML/CSS editor. Return ONLY a JSON array of find-and-replace operations. Each: {"find":"exact string","replace":"new string"}. RAW JSON only.`, messages: [{ role: 'user', content: `HTML:\n${currentHtml}\n\nIMAGES: ${JSON.stringify(mediaList)}\n\nREQUEST: ${messages[messages.length - 1]?.content}\n\nReturn JSON array:` }] }),
                  })
                  const hd = await htmlRes.json(); let rt = (hd.content?.[0]?.text || '').replace(/^```json?\s*/i, '').replace(/```\s*$/g, '').trim()
                  try {
                    const fb = rt.indexOf('['), lb = rt.lastIndexOf(']'); if (fb === -1 || lb === -1) throw new Error('No array')
                    const ops = JSON.parse(rt.substring(fb, lb + 1)); let mod = currentHtml; let applied = 0, failed = 0
                    for (const op of ops) { if (op.find && op.replace !== undefined) { if (mod.includes(op.find)) { mod = mod.replace(op.find, op.replace); applied++ } else failed++ } }
                    action.data.edit_results = { total_operations: ops.length, applied, failed }
                    if (applied > 0) { customHtml = mod; action.data.html_set = true; if (failed > 0) action.data.partial_warning = `${applied}/${ops.length} changes applied.` } else action.data.error = `None of the edits matched. Try being more specific.`
                  } catch { action.data.error = 'Could not generate edits. Try rephrasing.' }
                }
              }

              if (!action.data.error && wsAction !== 'suggest_improvements') {
                const { error } = await supabase.from('company_websites').update({ blocks, theme, custom_html: customHtml, undo_snapshot: undoSnapshot, updated_at: new Date().toISOString() }).eq('company_id', COMPANY_ID)
                if (error) action.data.error = error.message; else { action.data.created = true; action.data.can_undo = true }
              }
            } catch (e: any) { action.data.error = `Website update failed: ${e.message}` }
          }

        } catch (err: any) {
          console.error(`Action ${action.type} failed:`, err)
          action.data.error = err.message
        }
      }
    }

    // Strip HTML from response
    if (parsed.actions) parsed.actions = parsed.actions.map((a: any) => a.type === 'edit_website' && a.data?.custom_html ? { ...a, data: { ...a.data, custom_html: '[HTML_SAVED]' } } : a)
    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('AI assistant error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.', actions: [], requires_confirm: false }, { status: 500 })
  }
}