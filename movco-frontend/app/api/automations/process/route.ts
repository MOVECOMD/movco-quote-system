import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorised calls
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const now = new Date().toISOString()

    // Fetch all due enrollments
    const { data: enrollments, error: fetchError } = await supabase
      .from('automation_enrollments')
      .select(`
        *,
        automation_sequences(*, automation_steps(*)),
        crm_deals(customer_name, customer_email, customer_phone, moving_from, moving_to, moving_date, company_id)
      `)
      .eq('status', 'active')
      .lte('next_send_at', now)

    if (fetchError) throw fetchError
    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0

    for (const enrollment of enrollments) {
      try {
        const sequence = enrollment.automation_sequences
        const deal = enrollment.crm_deals
        if (!sequence || !deal) continue

        const steps = (sequence.automation_steps || []).sort(
          (a: any, b: any) => a.position - b.position
        )

        const currentStep = steps[enrollment.current_step]
        if (!currentStep) {
          // No more steps — mark complete
          await supabase
            .from('automation_enrollments')
            .update({ status: 'completed' })
            .eq('id', enrollment.id)
          continue
        }

        // Execute the step
        if (currentStep.step_type === 'send_email') {
          await handleSendEmail(currentStep, deal, sequence, enrollment)
        } else if (currentStep.step_type === 'create_task') {
          await handleCreateTask(currentStep, deal, enrollment)
        }

        // Advance to next step
        const nextStepIndex = enrollment.current_step + 1
        const nextStep = steps[nextStepIndex]

        if (nextStep) {
          const delayMs =
            nextStep.delay_unit === 'days'
              ? nextStep.delay_value * 24 * 60 * 60 * 1000
              : nextStep.delay_value * 60 * 60 * 1000

          await supabase
            .from('automation_enrollments')
            .update({
              current_step: nextStepIndex,
              next_send_at: new Date(Date.now() + delayMs).toISOString(),
            })
            .eq('id', enrollment.id)
        } else {
          await supabase
            .from('automation_enrollments')
            .update({ status: 'completed' })
            .eq('id', enrollment.id)
        }

        processed++
      } catch (stepErr: any) {
        console.error(`Error processing enrollment ${enrollment.id}:`, stepErr)
      }
    }

    // Also scan for days_before_move sequences
    await processDaysBeforeMove()

    return NextResponse.json({ processed })
  } catch (err: any) {
    console.error('Automation process error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function handleSendEmail(step: any, deal: any, sequence: any, enrollment: any) {
  const config = step.config || {}
  const subject = interpolate(config.subject || '', deal)
  const body = interpolate(config.body || '', deal)

  // Get Gmail connection for this company
  const { data: emailConn } = await supabase
    .from('email_connections')
    .select('*')
    .eq('company_id', deal.company_id)
    .maybeSingle()

  if (!emailConn || !deal.customer_email) return

  // Call existing send-custom email endpoint
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: deal.company_id,
      to: deal.customer_email,
      subject,
      body,
      deal_id: enrollment.deal_id,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Email send failed: ${err}`)
  }
}

async function handleCreateTask(step: any, deal: any, enrollment: any) {
  const config = step.config || {}
  const title = interpolate(config.task_title || 'Follow up', deal)
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  if (!deal.customer_id) return

  await supabase.from('crm_customer_tasks').insert({
    customer_id: deal.customer_id,
    title,
    due_date: dueDate,
    completed: false,
  })
}

async function processDaysBeforeMove() {
  // Find active days_before_move sequences
  const { data: sequences } = await supabase
    .from('automation_sequences')
    .select('*, automation_steps(*)')
    .eq('trigger_type', 'days_before_move')
    .eq('active', true)

  if (!sequences || sequences.length === 0) return

  for (const sequence of sequences) {
    const daysOffset = sequence.trigger_config?.days_before || 1
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysOffset)
    const dateStr = targetDate.toISOString().split('T')[0]

    // Find deals with matching moving_date not already enrolled
    const { data: deals } = await supabase
      .from('crm_deals')
      .select('id, customer_name, customer_email, customer_phone, moving_from, moving_to, moving_date, company_id')
      .eq('company_id', sequence.company_id)
      .eq('moving_date', dateStr)

    if (!deals || deals.length === 0) continue

    for (const deal of deals) {
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('sequence_id', sequence.id)
        .eq('deal_id', deal.id)
        .maybeSingle()

      if (existing) continue

      const steps = (sequence.automation_steps || []).sort(
        (a: any, b: any) => a.position - b.position
      )
      if (steps.length === 0) continue

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
}