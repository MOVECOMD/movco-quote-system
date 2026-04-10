import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id, first_name, last_name, email, phone, business_name, message, source } = body

    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    if (!first_name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })

    const fullName = `${first_name} ${last_name || ''}`.trim()

    // Check for existing customer by email
    const { data: existing } = await supabase
      .from('crm_customers')
      .select('id')
      .eq('company_id', company_id)
      .ilike('email', email)
      .maybeSingle()

    let customerId = existing?.id

    if (!customerId) {
      // Create new customer
      const { data: newCustomer, error: custErr } = await supabase
        .from('crm_customers')
        .insert({
          company_id,
          name: fullName,
          email,
          phone: phone || null,
          address: business_name || null,
          source: source || 'Website Enquiry',
          notes: message || null,
          tags: ['website-lead'],
        })
        .select()
        .single()

      if (custErr) return NextResponse.json({ error: 'Failed to create customer: ' + custErr.message }, { status: 500 })
      customerId = newCustomer.id
    } else {
      // Update existing customer with latest info
      await supabase
        .from('crm_customers')
        .update({
          phone: phone || undefined,
          notes: message ? `Website enquiry: ${message}` : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
    }

    // Find the first stage of the default pipeline to create a deal
    const { data: defaultPipeline } = await supabase
      .from('crm_pipelines')
      .select('id')
      .eq('company_id', company_id)
      .eq('is_default', true)
      .maybeSingle()

    const pipelineId = defaultPipeline?.id

    let dealId = null
    if (pipelineId) {
      const { data: firstStage } = await supabase
        .from('crm_pipeline_stages')
        .select('id, name')
        .eq('company_id', company_id)
        .eq('pipeline_id', pipelineId)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstStage) {
        // Create a deal in the first stage
        const { data: newDeal } = await supabase
          .from('crm_deals')
          .insert({
            company_id,
            customer_name: fullName,
            customer_email: email,
            customer_phone: phone || null,
            customer_id: customerId,
            stage_id: firstStage.id,
            notes: message ? `Website enquiry: ${message}` : 'Website enquiry',
            estimated_value: 0,
          })
          .select()
          .single()

        dealId = newDeal?.id
      }
    }

    // Add a note to the customer
    await supabase.from('crm_customer_notes').insert({
      company_id,
      customer_id: customerId,
      note_text: `📋 Website enquiry received.\n${business_name ? `Business: ${business_name}\n` : ''}${message ? `Message: ${message}` : ''}`.trim(),
    })

    return NextResponse.json({
      success: true,
      customer_id: customerId,
      deal_id: dealId,
      message: 'Enquiry received successfully',
    })
  } catch (err: any) {
    console.error('Website enquiry error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}