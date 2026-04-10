import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLOT_DURATION = 60 // minutes — must match availability endpoint

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { company_id, first_name, last_name, email, phone, business_name, date, time, event_type, notes } = body

    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
    if (!first_name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    if (!date || !time) return NextResponse.json({ error: 'Date and time are required' }, { status: 400 })

    const fullName = `${first_name} ${last_name || ''}`.trim()

    // Validate the slot is still available
    const startTime = new Date(`${date}T${time}:00`)
    const endTime = new Date(startTime.getTime() + SLOT_DURATION * 60000)
    const now = new Date()

    if (startTime <= now) {
      return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 400 })
    }

    // Check for double-booking
    const { data: conflicts } = await supabase
      .from('crm_diary_events')
      .select('id')
      .eq('company_id', company_id)
      .lt('start_time', endTime.toISOString())
      .gt('end_time', startTime.toISOString())
      .limit(1)

    // Also check events without end_time that start in this window
    const { data: conflicts2 } = await supabase
      .from('crm_diary_events')
      .select('id')
      .eq('company_id', company_id)
      .gte('start_time', startTime.toISOString())
      .lt('start_time', endTime.toISOString())
      .is('end_time', null)
      .limit(1)

    if ((conflicts && conflicts.length > 0) || (conflicts2 && conflicts2.length > 0)) {
      return NextResponse.json({ error: 'Sorry, this slot has just been booked. Please choose another time.' }, { status: 409 })
    }

    // Find or create customer
    let customerId: string | null = null
    const { data: existing } = await supabase
      .from('crm_customers')
      .select('id')
      .eq('company_id', company_id)
      .ilike('email', email)
      .maybeSingle()

    if (existing?.id) {
      customerId = existing.id
      // Update phone if provided
      if (phone) {
        await supabase.from('crm_customers').update({ phone, updated_at: new Date().toISOString() }).eq('id', customerId)
      }
    } else {
      const { data: newCustomer } = await supabase
        .from('crm_customers')
        .insert({
          company_id,
          name: fullName,
          email,
          phone: phone || null,
          address: business_name || null,
          source: 'Website Booking',
          tags: ['website-booking'],
        })
        .select()
        .single()
      customerId = newCustomer?.id || null
    }

    // Create deal in first pipeline stage
    let dealId: string | null = null
    const { data: defaultPipeline } = await supabase
      .from('crm_pipelines')
      .select('id')
      .eq('company_id', company_id)
      .eq('is_default', true)
      .maybeSingle()

    if (defaultPipeline?.id) {
      const { data: firstStage } = await supabase
        .from('crm_pipeline_stages')
        .select('id')
        .eq('company_id', company_id)
        .eq('pipeline_id', defaultPipeline.id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstStage) {
        const { data: newDeal } = await supabase
          .from('crm_deals')
          .insert({
            company_id,
            customer_name: fullName,
            customer_email: email,
            customer_phone: phone || null,
            customer_id: customerId,
            stage_id: firstStage.id,
            notes: `Booked via website: ${date} at ${time}`,
            estimated_value: 0,
          })
          .select()
          .single()
        dealId = newDeal?.id || null
      }
    }

    // Create diary event
    const { data: event, error: eventErr } = await supabase
      .from('crm_diary_events')
      .insert({
        company_id,
        title: `${event_type || 'Consultation'} — ${fullName}`,
        event_type: event_type || 'consultation',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        customer_name: fullName,
        deal_id: dealId,
        description: `Booked via website.\n${business_name ? `Business: ${business_name}\n` : ''}Email: ${email}${phone ? `\nPhone: ${phone}` : ''}${notes ? `\nNotes: ${notes}` : ''}`,
        color: '#7b3a8b',
        completed: false,
      })
      .select()
      .single()

    if (eventErr) {
      return NextResponse.json({ error: 'Failed to create booking: ' + eventErr.message }, { status: 500 })
    }

    // Add note to customer
    if (customerId) {
      await supabase.from('crm_customer_notes').insert({
        company_id,
        customer_id: customerId,
        note_text: `📅 Booked ${event_type || 'consultation'} via website for ${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${time}`,
      })
    }

    return NextResponse.json({
      success: true,
      event_id: event.id,
      customer_id: customerId,
      deal_id: dealId,
      booking: {
        date,
        time,
        end_time: `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`,
        name: fullName,
      },
    })
  } catch (err: any) {
    console.error('Booking error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}