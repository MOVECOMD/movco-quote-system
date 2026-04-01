import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const now = new Date().toISOString()
    let processed = 0

    // 1. Process all due enrollments
    const { data: enrollments, error: fetchError } = await supabase
      .from('automation_enrollments')
      .select(`
        *,
        automation_sequences(*, automation_steps(*)),
        crm_deals(id, customer_id, customer_name, customer_email, customer_phone, moving_from, moving_to, moving_date, estimated_value, stage_id, company_id, notes)
      `)
      .eq('status', 'active')
      .eq('waiting_for_reply', false)
      .lte('next_send_at', now)
      .limit(100)

    if (fetchError) throw fetchError

    for (const enrollment of (enrollments || [])) {
      try {
        const sequence = enrollment.automation_sequences
        const deal = enrollment.crm_deals
        if (!sequence || !deal) continue

        const steps = (sequence.automation_steps || []).sort(
          (a: any, b: any) => a.position - b.position
        )

        const currentStep = steps[enrollment.current_step]
        if (!currentStep) {
          await markComplete(enrollment.id)
          continue
        }

        // Execute the step based on type
        const result = await executeStep(currentStep, deal, enrollment, sequence)

        // Log the action
        await logAction(deal.company_id, enrollment.id, sequence.id, currentStep.id, deal.id, currentStep.step_type, result)

        // Handle branching for condition steps
        if (currentStep.step_type === 'condition') {
          const conditionMet = evaluateCondition(currentStep.condition_config, deal)
          const nextIndex = conditionMet
            ? findStepIndex(steps, currentStep.yes_next_id) ?? enrollment.current_step + 1
            : findStepIndex(steps, currentStep.no_next_id) ?? enrollment.current_step + 1

          await advanceToStep(enrollment.id, nextIndex, steps, nextIndex)
        } else if (currentStep.step_type === 'wait_for_reply') {
          // Pause enrollment until reply received
          await supabase.from('automation_enrollments').update({
            waiting_for_reply: true,
            waiting_since: now,
          }).eq('id', enrollment.id)
        } else {
          // Advance to next step
          await advanceToStep(enrollment.id, enrollment.current_step + 1, steps)
        }

        processed++
      } catch (stepErr: any) {
        console.error(`Error processing enrollment ${enrollment.id}:`, stepErr)
        await logAction(
          enrollment.crm_deals?.company_id,
          enrollment.id,
          enrollment.automation_sequences?.id,
          null,
          enrollment.crm_deals?.id,
          'error',
          { error: stepErr.message }
        )
      }
    }

    // 2. Check for timed-out wait_for_reply enrollments (48hr default timeout)
    await processWaitTimeouts()

    // 3. Scan for days_before_move triggers
    await processDaysBeforeMove()

    // 4. Scan for no_response triggers
    await processNoResponse()

    return NextResponse.json({ processed })
  } catch (err: any) {
    console.error('Automation process error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── STEP EXECUTION ──

async function executeStep(step: any, deal: any, enrollment: any, sequence: any) {
  const config = step.config || {}

  switch (step.step_type) {
    case 'send_email':
      return await handleSendEmail(config, deal)

    case 'send_sms':
      return await handleSendSms(config, deal)

    case 'send_whatsapp':
      return await handleSendWhatsapp(config, deal)

    case 'create_task':
      return await handleCreateTask(config, deal)

    case 'move_deal':
      return await handleMoveDeal(config, deal)

    case 'notify':
      return await handleNotify(config, deal)

    case 'add_note':
      return await handleAddNote(config, deal)

    case 'condition':
      return { type: 'condition', evaluated: true }

    case 'wait_for_reply':
      return { type: 'wait_for_reply', timeout_hours: config.timeout_hours || 48 }

    case 'delay':
      return { type: 'delay' }

    default:
      return { type: 'unknown', step_type: step.step_type }
  }
}

async function handleSendEmail(config: any, deal: any) {
  const subject = interpolate(config.subject || '', deal)
  const body = interpolate(config.body || '', deal)

  if (!deal.customer_email) return { error: 'No customer email' }

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: deal.company_id,
      recipient_email: deal.customer_email,
      recipient_name: deal.customer_name,
      subject,
      body_text: body,
    }),
  })

  return { sent: res.ok, to: deal.customer_email, subject }
}

async function handleSendSms(config: any, deal: any) {
  const message = interpolate(config.message || '', deal)
  if (!deal.customer_phone) return { error: 'No customer phone' }

  // Use existing WhatsApp/SMS API if available
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: deal.company_id,
        to: deal.customer_phone,
        message,
        type: 'sms',
      }),
    })
    return { sent: res.ok, to: deal.customer_phone }
  } catch {
    return { error: 'SMS send failed' }
  }
}

async function handleSendWhatsapp(config: any, deal: any) {
  const message = interpolate(config.message || '', deal)
  if (!deal.customer_phone) return { error: 'No customer phone' }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: deal.company_id,
        to: deal.customer_phone,
        message,
      }),
    })
    return { sent: res.ok, to: deal.customer_phone }
  } catch {
    return { error: 'WhatsApp send failed' }
  }
}

async function handleCreateTask(config: any, deal: any) {
  const title = interpolate(config.task_title || 'Follow up', deal)
  const dueDays = config.due_in_days || 1
  const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000).toISOString()

  // Get or find customer_id
  let customerId = deal.customer_id
  if (!customerId) {
    const { data } = await supabase
      .from('crm_customers')
      .select('id')
      .eq('company_id', deal.company_id)
      .ilike('name', `%${deal.customer_name}%`)
      .maybeSingle()
    customerId = data?.id
  }

  if (!customerId) return { error: 'No customer found' }

  await supabase.from('crm_customer_tasks').insert({
    company_id: deal.company_id,
    customer_id: customerId,
    title,
    due_date: dueDate,
    completed: false,
  })

  return { created: true, title, due: dueDate }
}

async function handleMoveDeal(config: any, deal: any) {
  const newStageId = config.stage_id
  if (!newStageId) return { error: 'No target stage specified' }

  await supabase.from('crm_deals').update({
    stage_id: newStageId,
    updated_at: new Date().toISOString(),
  }).eq('id', deal.id)

  // Log note on customer
  if (deal.customer_id) {
    const { data: stage } = await supabase.from('crm_pipeline_stages').select('name').eq('id', newStageId).maybeSingle()
    await supabase.from('crm_customer_notes').insert({
      company_id: deal.company_id,
      customer_id: deal.customer_id,
      note_text: `🤖 Automation moved deal to "${stage?.name || 'new stage'}"`,
    })
  }

  return { moved: true, new_stage_id: newStageId }
}

async function handleNotify(config: any, deal: any) {
  const message = interpolate(config.message || 'Automation notification', deal)

  // Insert into a notifications table or send email to company owner
  const { data: company } = await supabase.from('companies').select('email').eq('id', deal.company_id).maybeSingle()

  if (company?.email) {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send-custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: deal.company_id,
        recipient_email: company.email,
        recipient_name: 'Team',
        subject: `🤖 Automation Alert: ${deal.customer_name}`,
        body_text: message,
      }),
    })
  }

  return { notified: true, message }
}

async function handleAddNote(config: any, deal: any) {
  const note = interpolate(config.note_text || '', deal)
  if (!deal.customer_id) return { error: 'No customer_id' }

  await supabase.from('crm_customer_notes').insert({
    company_id: deal.company_id,
    customer_id: deal.customer_id,
    note_text: `🤖 ${note}`,
  })

  return { added: true }
}

// ── CONDITION EVALUATION ──

function evaluateCondition(config: any, deal: any): boolean {
  if (!config) return true

  const { field, operator, value } = config

  const dealValue = deal[field]
  if (dealValue === undefined || dealValue === null) return false

  switch (operator) {
    case 'equals': return String(dealValue).toLowerCase() === String(value).toLowerCase()
    case 'not_equals': return String(dealValue).toLowerCase() !== String(value).toLowerCase()
    case 'greater_than': return Number(dealValue) > Number(value)
    case 'less_than': return Number(dealValue) < Number(value)
    case 'contains': return String(dealValue).toLowerCase().includes(String(value).toLowerCase())
    case 'not_empty': return !!dealValue && String(dealValue).trim() !== ''
    case 'is_empty': return !dealValue || String(dealValue).trim() === ''
    default: return true
  }
}

// ── HELPERS ──

function findStepIndex(steps: any[], stepId: string | null): number | null {
  if (!stepId) return null
  const idx = steps.findIndex((s: any) => s.id === stepId)
  return idx >= 0 ? idx : null
}

async function advanceToStep(enrollmentId: string, nextIndex: number, steps: any[], overrideIndex?: number) {
  const idx = overrideIndex ?? nextIndex
  const nextStep = steps[idx]

  if (nextStep) {
    const delayMs = nextStep.delay_unit === 'days'
      ? (nextStep.delay_value || 0) * 24 * 60 * 60 * 1000
      : (nextStep.delay_value || 0) * 60 * 60 * 1000

    await supabase.from('automation_enrollments').update({
      current_step: idx,
      next_send_at: new Date(Date.now() + delayMs).toISOString(),
    }).eq('id', enrollmentId)
  } else {
    await markComplete(enrollmentId)
  }
}

async function markComplete(enrollmentId: string) {
  await supabase.from('automation_enrollments').update({ status: 'completed' }).eq('id', enrollmentId)
}

async function logAction(companyId: string, enrollmentId: string, sequenceId: string, stepId: string | null, dealId: string, actionType: string, data: any) {
  try {
    await supabase.from('automation_logs').insert({
      company_id: companyId,
      enrollment_id: enrollmentId,
      sequence_id: sequenceId,
      step_id: stepId,
      deal_id: dealId,
      action_type: actionType,
      action_data: data,
      status: data.error ? 'failed' : 'success',
      error_message: data.error || null,
    })
  } catch (e) {
    console.error('Failed to log automation action:', e)
  }
}

// ── TIMED PROCESSES ──

async function processWaitTimeouts() {
  const timeout = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: waiting } = await supabase
    .from('automation_enrollments')
    .select('*, automation_sequences(automation_steps(*))')
    .eq('status', 'active')
    .eq('waiting_for_reply', true)
    .lte('waiting_since', timeout)

  for (const enrollment of (waiting || [])) {
    const steps = (enrollment.automation_sequences?.automation_steps || []).sort(
      (a: any, b: any) => a.position - b.position
    )

    await supabase.from('automation_enrollments').update({
      waiting_for_reply: false,
      waiting_since: null,
    }).eq('id', enrollment.id)

    await advanceToStep(enrollment.id, enrollment.current_step + 1, steps)
  }
}

async function processDaysBeforeMove() {
  const { data: sequences } = await supabase
    .from('automation_sequences')
    .select('*, automation_steps(*)')
    .eq('trigger_type', 'days_before_move')
    .eq('active', true)

  if (!sequences?.length) return

  for (const sequence of sequences) {
    const daysOffset = sequence.trigger_config?.days_before || 1
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysOffset)
    const dateStr = targetDate.toISOString().split('T')[0]

    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id')
      .eq('company_id', sequence.company_id)
      .eq('moving_date', dateStr)

    for (const deal of (deals || [])) {
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('sequence_id', sequence.id)
        .eq('deal_id', deal.id)
        .maybeSingle()

      if (existing) continue

      await supabase.from('automation_enrollments').insert({
        sequence_id: sequence.id,
        deal_id: deal.id,
        current_step: 0,
        next_send_at: new Date().toISOString(),
        status: 'active',
      })
    }
  }
}

async function processNoResponse() {
  const { data: sequences } = await supabase
    .from('automation_sequences')
    .select('*, automation_steps(*)')
    .eq('trigger_type', 'no_response')
    .eq('active', true)

  if (!sequences?.length) return

  for (const sequence of sequences) {
    const daysWithout = sequence.trigger_config?.days_without_response || 3
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysWithout)

    // Find deals in a specific stage with no recent notes/events
    const targetStageId = sequence.trigger_config?.stage_id
    if (!targetStageId) continue

    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id, customer_id')
      .eq('company_id', sequence.company_id)
      .eq('stage_id', targetStageId)

    for (const deal of (deals || [])) {
      // Check for recent activity
      const { data: recentNotes } = await supabase
        .from('crm_customer_notes')
        .select('id')
        .eq('customer_id', deal.customer_id)
        .gte('created_at', cutoff.toISOString())
        .limit(1)

      if (recentNotes?.length) continue

      // Check not already enrolled
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('sequence_id', sequence.id)
        .eq('deal_id', deal.id)
        .in('status', ['active', 'completed'])
        .maybeSingle()

      if (existing) continue

      await supabase.from('automation_enrollments').insert({
        sequence_id: sequence.id,
        deal_id: deal.id,
        current_step: 0,
        next_send_at: new Date().toISOString(),
        status: 'active',
      })
    }
  }
}

function interpolate(template: string, deal: any): string {
  return template
    .replace(/\{name\}/g, deal.customer_name || '')
    .replace(/\{email\}/g, deal.customer_email || '')
    .replace(/\{phone\}/g, deal.customer_phone || '')
    .replace(/\{moving_from\}/g, deal.moving_from || '')
    .replace(/\{moving_to\}/g, deal.moving_to || '')
    .replace(/\{moving_date\}/g, deal.moving_date || '')
    .replace(/\{value\}/g, deal.estimated_value ? `£${deal.estimated_value}` : '')
    .replace(/\{notes\}/g, deal.notes || '')
}