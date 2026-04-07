// app/api/seed-company/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSeedData } from '@/lib/templateSeeds'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { company_id, template_type } = await req.json()

    if (!company_id) {
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    }

    const seed = getSeedData(template_type || 'default')
    const results: { pipeline: boolean; stages: number; event_types: boolean; customer_fields: boolean; errors: string[] } = {
      pipeline: false,
      stages: 0,
      event_types: false,
      customer_fields: false,
      errors: [],
    }

    // ── 1. CREATE DEFAULT PIPELINE (if none exists) ──
    const { data: existingPipelines } = await supabase
      .from('crm_pipelines')
      .select('id')
      .eq('company_id', company_id)
      .limit(1)

    let defaultPipelineId: string | null = null

    if (!existingPipelines || existingPipelines.length === 0) {
      const pipelineName = template_type === 'removals' ? 'Sales Pipeline'
        : template_type === 'estate_agent' ? 'Sales Pipeline'
        : template_type === 'vet' ? 'Patient Pipeline'
        : template_type === 'dental' ? 'Patient Pipeline'
        : template_type === 'salon' ? 'Client Pipeline'
        : 'Sales Pipeline'

      const { data: newPipeline, error: pipelineErr } = await supabase
        .from('crm_pipelines')
        .insert({
          company_id,
          name: pipelineName,
          color: '#3b82f6',
          position: 1,
          is_default: true,
        })
        .select()
        .single()

      if (pipelineErr) {
        results.errors.push(`Pipeline: ${pipelineErr.message}`)
      } else {
        defaultPipelineId = newPipeline.id
        results.pipeline = true
      }
    } else {
      defaultPipelineId = existingPipelines[0].id
    }

    // ── 2. SEED PIPELINE STAGES (if none exist) ──
    const { data: existingStages } = await supabase
      .from('crm_pipeline_stages')
      .select('id')
      .eq('company_id', company_id)
      .limit(1)

    if ((!existingStages || existingStages.length === 0) && defaultPipelineId) {
      const stageInserts = seed.stages.map(s => ({
        company_id,
        pipeline_id: defaultPipelineId,
        name: s.name,
        color: s.color,
        position: s.position,
      }))

      const { data: insertedStages, error: stagesErr } = await supabase
        .from('crm_pipeline_stages')
        .insert(stageInserts)
        .select()

      if (stagesErr) {
        results.errors.push(`Stages: ${stagesErr.message}`)
      } else {
        results.stages = insertedStages?.length || 0
      }
    } else {
      results.stages = -1
    }

    // ── 3. SEED EVENT TYPES + CUSTOMER FIELDS ──
    const { data: existingConfig } = await supabase
      .from('company_config')
      .select('custom_event_types, custom_customer_fields')
      .eq('company_id', company_id)
      .maybeSingle()

    const updates: any = {}

    if (!existingConfig?.custom_event_types || existingConfig.custom_event_types.length === 0) {
      updates.custom_event_types = seed.event_types
      results.event_types = true
    }

    if (!existingConfig?.custom_customer_fields || existingConfig.custom_customer_fields.length === 0) {
      updates.custom_customer_fields = seed.customer_fields
      results.customer_fields = true
    }

    if (Object.keys(updates).length > 0) {
      const { error: configErr } = await supabase
        .from('company_config')
        .upsert({ company_id, ...updates }, { onConflict: 'company_id' })

      if (configErr) {
        results.errors.push(`Config: ${configErr.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      template_type: template_type || 'default',
      results,
      message: `Seeded: ${results.pipeline ? '1 pipeline, ' : ''}${results.stages >= 0 ? results.stages : 0} stages, ${results.event_types ? seed.event_types.length : 0} event types, ${results.customer_fields ? seed.customer_fields.length : 0} custom fields`,
    })
  } catch (err: any) {
    console.error('Seed company error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const templateType = req.nextUrl.searchParams.get('template_type') || 'default'
  const seed = getSeedData(templateType)

  return NextResponse.json({
    template_type: templateType,
    stages: seed.stages,
    event_types: seed.event_types,
    customer_fields: seed.customer_fields,
  })
}