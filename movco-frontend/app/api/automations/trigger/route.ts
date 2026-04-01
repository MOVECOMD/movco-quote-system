import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { company_id, trigger_type, trigger_config, deal_id } = await req.json()

    if (!company_id || !trigger_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find all active sequences for this company matching the trigger
    const { data: sequences, error: seqError } = await supabase
      .from('automation_sequences')
      .select('*, automation_steps(*)')
      .eq('company_id', company_id)
      .eq('trigger_type', trigger_type)
      .eq('active', true)

    if (seqError) throw seqError
    if (!sequences || sequences.length === 0) {
      return NextResponse.json({ enrolled: 0 })
    }

    const enrollments = []

    for (const sequence of sequences) {
      // ── TRIGGER MATCHING ──

      if (trigger_type === 'stage_change') {
        const configStageId = sequence.trigger_config?.stage_id
        if (configStageId && configStageId !== trigger_config?.stage_id) continue
      }

      if (trigger_type === 'new_deal') {
        // No extra filtering — triggers on any new deal
      }

      if (trigger_type === 'quote_sent') {
        // Triggers when a quote is sent
      }

      if (trigger_type === 'quote_accepted') {
        // Triggers when quote status changes to accepted
      }

      if (trigger_type === 'quote_declined') {
        // Triggers when quote status changes to declined
      }

      if (trigger_type === 'manual') {
        // Always enrolls — manually triggered by user
      }

      // Skip cron-based triggers — handled by the process route
      if (['days_before_move', 'no_response'].includes(trigger_type)) continue

      if (!deal_id) continue

      // Check not already enrolled and active in this sequence
      const { data: existing } = await supabase
        .from('automation_enrollments')
        .select('id')
        .eq('sequence_id', sequence.id)
        .eq('deal_id', deal_id)
        .eq('status', 'active')
        .maybeSingle()

      if (existing) continue

      // Sort steps by position, get first step delay
      const steps = (sequence.automation_steps || []).sort(
        (a: any, b: any) => a.position - b.position
      )

      if (steps.length === 0) continue

      const firstStep = steps[0]
      const delayMs =
        firstStep.delay_unit === 'days'
          ? (firstStep.delay_value || 0) * 24 * 60 * 60 * 1000
          : (firstStep.delay_value || 0) * 60 * 60 * 1000

      const next_send_at = new Date(Date.now() + delayMs).toISOString()

      enrollments.push({
        sequence_id: sequence.id,
        deal_id,
        current_step: 0,
        next_send_at,
        status: 'active',
      })
    }

    if (enrollments.length > 0) {
      const { error: enrollError } = await supabase
        .from('automation_enrollments')
        .insert(enrollments)
      if (enrollError) throw enrollError

      // Update sequence stats
      for (const e of enrollments) {
        await supabase.from('automation_sequences').update({
          last_triggered_at: new Date().toISOString(),
        }).eq('id', e.sequence_id)
      }
    }

    return NextResponse.json({ enrolled: enrollments.length })
  } catch (err: any) {
    console.error('Automation trigger error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}