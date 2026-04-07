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

    const resolvedType = template_type || 'default'
    const seed = getSeedData(resolvedType)
    const results: {
      pipeline: boolean
      stages: number
      event_types: boolean
      customer_fields: boolean
      terminology: boolean
      errors: string[]
    } = {
      pipeline: false,
      stages: 0,
      event_types: false,
      customer_fields: false,
      terminology: false,
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
      // Load pipeline name from template_configs if available
      const { data: templateConfig } = await supabase
        .from('template_configs')
        .select('terminology')
        .eq('template_type', resolvedType)
        .maybeSingle()

      const pipelineLabel = templateConfig?.terminology?.pipeline || 'Sales Pipeline'

      const { data: newPipeline, error: pipelineErr } = await supabase
        .from('crm_pipelines')
        .insert({
          company_id,
          name: pipelineLabel,
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

    // ── 4. ENSURE TEMPLATE_CONFIGS ROW EXISTS ──
    // If there's no template_configs row for this type, create one from defaults
    const { data: existingTemplateConfig } = await supabase
      .from('template_configs')
      .select('template_type')
      .eq('template_type', resolvedType)
      .maybeSingle()

    if (!existingTemplateConfig) {
      // Insert a basic row so the dashboard can read terminology
      const defaultTerminology: Record<string, string> = {
        quotes: 'Quotes',
        pipeline: 'Pipeline',
        diary: 'Diary',
        customers: 'Customers',
        reports: 'Reports',
        leads: 'Leads',
        deals: 'Deals',
        deal: 'Deal',
      }

      const defaultFlags: Record<string, any> = {
        show_quote_builder: true,
        show_coverage_postcodes: false,
        show_moving_fields: false,
        show_volume_calculator: false,
        show_van_count: false,
        show_movers_count: false,
        show_packing_service: false,
        show_day_plan: false,
        show_invoice: true,
        quote_builder_type: 'simple',
      }

      const { error: tplErr } = await supabase
        .from('template_configs')
        .insert({
          template_type: resolvedType,
          terminology: defaultTerminology,
          feature_flags: defaultFlags,
        })

      if (tplErr) {
        results.errors.push(`TemplateConfig: ${tplErr.message}`)
      } else {
        results.terminology = true
      }
    }

    return NextResponse.json({
      success: true,
      template_type: resolvedType,
      results,
      message: `Seeded: ${results.pipeline ? '1 pipeline, ' : ''}${results.stages >= 0 ? results.stages : 0} stages, ${results.event_types ? seed.event_types.length : 0} event types, ${results.customer_fields ? seed.customer_fields.length : 0} custom fields${results.terminology ? ', template config created' : ''}`,
    })
  } catch (err: any) {
    console.error('Seed company error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const templateType = req.nextUrl.searchParams.get('template_type') || 'default'
  const seed = getSeedData(templateType)

  // Also return terminology + feature flags from template_configs
  const { data: templateConfig } = await supabase
    .from('template_configs')
    .select('terminology, feature_flags')
    .eq('template_type', templateType)
    .maybeSingle()

  return NextResponse.json({
    template_type: templateType,
    stages: seed.stages,
    event_types: seed.event_types,
    customer_fields: seed.customer_fields,
    terminology: templateConfig?.terminology || null,
    feature_flags: templateConfig?.feature_flags || null,
  })
}