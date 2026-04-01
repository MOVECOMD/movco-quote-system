// ============================================================
// FILE: movco-frontend/app/api/automations/save/route.ts
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CREATE or UPDATE a sequence
export async function POST(req: NextRequest) {
  try {
    const { company_id, sequence } = await req.json()
    if (!company_id || !sequence) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

    const seqData = {
      company_id,
      name: sequence.name,
      description: sequence.description || null,
      trigger_type: sequence.trigger_type,
      trigger_config: sequence.trigger_config || {},
      active: sequence.active ?? true,
    }

    let sequenceId = sequence.id

    if (sequenceId) {
      // Update existing
      const { error } = await supabase
        .from('automation_sequences')
        .update(seqData)
        .eq('id', sequenceId)
      if (error) throw error

      // Delete existing steps and re-insert (simplest approach for reordering)
      await supabase.from('automation_steps').delete().eq('sequence_id', sequenceId)
    } else {
      // Create new
      const { data, error } = await supabase
        .from('automation_sequences')
        .insert(seqData)
        .select()
        .single()
      if (error) throw error
      sequenceId = data.id
    }

    // Insert steps
    if (sequence.steps && sequence.steps.length > 0) {
      const steps = sequence.steps.map((step: any, idx: number) => ({
        sequence_id: sequenceId,
        step_type: step.step_type,
        config: step.config || {},
        delay_value: step.delay_value || 0,
        delay_unit: step.delay_unit || 'hours',
        position: idx,
        condition_config: step.condition_config || {},
      }))

      const { error: stepsError } = await supabase.from('automation_steps').insert(steps)
      if (stepsError) throw stepsError
    }

    return NextResponse.json({ success: true, sequence_id: sequenceId })
  } catch (err: any) {
    console.error('Save automation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE a sequence
export async function DELETE(req: NextRequest) {
  try {
    const { sequence_id } = await req.json()
    if (!sequence_id) return NextResponse.json({ error: 'Missing sequence_id' }, { status: 400 })

    // Delete enrollments first
    await supabase.from('automation_enrollments').delete().eq('sequence_id', sequence_id)
    // Delete steps
    await supabase.from('automation_steps').delete().eq('sequence_id', sequence_id)
    // Delete logs
    await supabase.from('automation_logs').delete().eq('sequence_id', sequence_id)
    // Delete sequence
    const { error } = await supabase.from('automation_sequences').delete().eq('id', sequence_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — toggle active
export async function PATCH(req: NextRequest) {
  try {
    const { sequence_id, active } = await req.json()
    if (!sequence_id) return NextResponse.json({ error: 'Missing sequence_id' }, { status: 400 })

    const { error } = await supabase
      .from('automation_sequences')
      .update({ active })
      .eq('id', sequence_id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}