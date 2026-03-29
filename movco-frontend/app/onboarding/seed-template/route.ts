import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEMPLATE_STAGES: Record<string, { name: string; color: string; position: number }[]> = {
  removals: [
    { name: 'New Enquiry', color: '#6366f1', position: 1 },
    { name: 'Quote Sent', color: '#f59e0b', position: 2 },
    { name: 'Booked', color: '#10b981', position: 3 },
    { name: 'Completed', color: '#0F6E56', position: 4 },
    { name: 'Lost', color: '#ef4444', position: 5 },
  ],
  plumber: [
    { name: 'New Enquiry', color: '#6366f1', position: 1 },
    { name: 'Estimate Sent', color: '#f59e0b', position: 2 },
    { name: 'Booked', color: '#10b981', position: 3 },
    { name: 'In Progress', color: '#3b82f6', position: 4 },
    { name: 'Completed', color: '#0F6E56', position: 5 },
    { name: 'Lost', color: '#ef4444', position: 6 },
  ],
  estate_agent: [
    { name: 'Valuation', color: '#6366f1', position: 1 },
    { name: 'Listed', color: '#f59e0b', position: 2 },
    { name: 'Viewing Booked', color: '#10b981', position: 3 },
    { name: 'Offer Received', color: '#3b82f6', position: 4 },
    { name: 'Under Offer', color: '#8b5cf6', position: 5 },
    { name: 'Exchanged', color: '#0F6E56', position: 6 },
    { name: 'Completed', color: '#059669', position: 7 },
    { name: 'Withdrawn', color: '#ef4444', position: 8 },
  ],
  cleaning: [
    { name: 'New Enquiry', color: '#6366f1', position: 1 },
    { name: 'Quote Sent', color: '#f59e0b', position: 2 },
    { name: 'Trial Clean', color: '#10b981', position: 3 },
    { name: 'Regular Client', color: '#0F6E56', position: 4 },
    { name: 'One-off', color: '#3b82f6', position: 5 },
    { name: 'Cancelled', color: '#ef4444', position: 6 },
  ],
  vet: [
    { name: 'New Patient', color: '#6366f1', position: 1 },
    { name: 'Appointment Booked', color: '#f59e0b', position: 2 },
    { name: 'Awaiting Results', color: '#3b82f6', position: 3 },
    { name: 'Treatment', color: '#10b981', position: 4 },
    { name: 'Follow-up', color: '#8b5cf6', position: 5 },
    { name: 'Discharged', color: '#0F6E56', position: 6 },
  ],
  dental: [
    { name: 'New Patient', color: '#6366f1', position: 1 },
    { name: 'Assessment', color: '#f59e0b', position: 2 },
    { name: 'Treatment Planned', color: '#3b82f6', position: 3 },
    { name: 'In Treatment', color: '#10b981', position: 4 },
    { name: 'Recall Due', color: '#8b5cf6', position: 5 },
    { name: 'Discharged', color: '#0F6E56', position: 6 },
  ],
  retail: [
    { name: 'New Order', color: '#6366f1', position: 1 },
    { name: 'Processing', color: '#f59e0b', position: 2 },
    { name: 'Dispatched', color: '#3b82f6', position: 3 },
    { name: 'Delivered', color: '#0F6E56', position: 4 },
    { name: 'Return Requested', color: '#8b5cf6', position: 5 },
    { name: 'Refunded', color: '#ef4444', position: 6 },
  ],
  salon: [
    { name: 'New Enquiry', color: '#6366f1', position: 1 },
    { name: 'Booked', color: '#f59e0b', position: 2 },
    { name: 'Confirmed', color: '#10b981', position: 3 },
    { name: 'Completed', color: '#0F6E56', position: 4 },
    { name: 'No Show', color: '#ef4444', position: 5 },
    { name: 'Rebooked', color: '#8b5cf6', position: 6 },
  ],
}

const TEMPLATE_EMAIL_TEMPLATES: Record<string, { name: string; subject: string; body: string }[]> = {
  removals: [
    {
      name: 'Quote follow-up',
      subject: 'Following up on your removal quote',
      body: `Hi {{customer_name}},\n\nI hope you're well! I just wanted to follow up on the removal quote we sent you recently.\n\nWe'd love to help make your move as smooth as possible. If you have any questions about the quote or would like to discuss anything, please don't hesitate to get in touch.\n\nBest regards,\n{{company_name}}`,
    },
    {
      name: 'Booking confirmation',
      subject: 'Your removal is confirmed!',
      body: `Hi {{customer_name}},\n\nGreat news — your removal is confirmed! Here are your details:\n\nDate: {{moving_date}}\nFrom: {{moving_from}}\nTo: {{moving_to}}\n\nWe'll be in touch closer to the date with more details. If you have any questions in the meantime, please give us a call.\n\nLooking forward to helping you move!\n\n{{company_name}}`,
    },
  ],
  plumber: [
    {
      name: 'Estimate follow-up',
      subject: 'Following up on your plumbing estimate',
      body: `Hi {{customer_name}},\n\nI hope you're well. I just wanted to follow up on the estimate we sent you for your plumbing work.\n\nWe're ready to get started whenever suits you. If you have any questions or would like to adjust anything on the quote, just let me know.\n\nBest regards,\n{{company_name}}`,
    },
    {
      name: 'Job confirmation',
      subject: 'Your job is booked in!',
      body: `Hi {{customer_name}},\n\nYour job is confirmed and booked in. We'll be with you on the agreed date and time.\n\nIf anything changes or you need to rearrange, please give us a call as soon as possible.\n\nThanks,\n{{company_name}}`,
    },
    {
      name: 'Job completion',
      subject: 'Job completed — thank you!',
      body: `Hi {{customer_name}},\n\nThank you for choosing us for your plumbing work. We hope everything is working perfectly!\n\nIf you notice anything or need any follow-up work, please don't hesitate to get in touch. We'd also really appreciate a review if you're happy with the work.\n\nThanks again,\n{{company_name}}`,
    },
  ],
  estate_agent: [
    {
      name: 'Viewing confirmation',
      subject: 'Your viewing is confirmed',
      body: `Hi {{customer_name}},\n\nYour viewing is confirmed. We look forward to showing you the property.\n\nIf you need to rearrange or have any questions beforehand, please don't hesitate to contact us.\n\nKind regards,\n{{company_name}}`,
    },
    {
      name: 'Offer received',
      subject: 'We have an offer on your property',
      body: `Hi {{customer_name}},\n\nWe're pleased to let you know that we've received an offer on your property. Please give us a call at your earliest convenience so we can discuss the details.\n\nKind regards,\n{{company_name}}`,
    },
  ],
  cleaning: [
    {
      name: 'Quote follow-up',
      subject: 'Following up on your cleaning quote',
      body: `Hi {{customer_name}},\n\nI hope you're well! I just wanted to follow up on the cleaning quote we sent you.\n\nWe'd love to get you booked in. If you have any questions or would like to arrange a trial clean, please get in touch.\n\nBest regards,\n{{company_name}}`,
    },
    {
      name: 'Booking confirmation',
      subject: 'Your clean is booked!',
      body: `Hi {{customer_name}},\n\nYour cleaning appointment is confirmed. We look forward to seeing you on the agreed date.\n\nIf you need to rearrange, please give us at least 24 hours notice.\n\nThanks,\n{{company_name}}`,
    },
  ],
  vet: [
    {
      name: 'Appointment confirmation',
      subject: 'Appointment confirmed',
      body: `Hi {{customer_name}},\n\nThis is a confirmation of your upcoming appointment with us. Please arrive a few minutes early and bring any relevant medical history for your pet.\n\nIf you need to cancel or rearrange, please let us know as soon as possible.\n\nSee you soon,\n{{company_name}}`,
    },
    {
      name: 'Vaccination reminder',
      subject: "Your pet's vaccination is due",
      body: `Hi {{customer_name}},\n\nThis is a friendly reminder that your pet's vaccination is due soon. Please get in touch to book an appointment at your earliest convenience.\n\nKind regards,\n{{company_name}}`,
    },
  ],
  dental: [
    {
      name: 'Appointment confirmation',
      subject: 'Your dental appointment is confirmed',
      body: `Hi {{customer_name}},\n\nThis is a confirmation of your upcoming dental appointment. Please arrive a few minutes early.\n\nIf you need to cancel or rearrange, please give us at least 24 hours notice.\n\nSee you soon,\n{{company_name}}`,
    },
    {
      name: 'Recall reminder',
      subject: "Time for your dental check-up",
      body: `Hi {{customer_name}},\n\nIt's time for your regular dental check-up! Please get in touch to book your appointment at a time that suits you.\n\nKind regards,\n{{company_name}}`,
    },
  ],
  retail: [
    {
      name: 'Order confirmation',
      subject: 'Your order is confirmed',
      body: `Hi {{customer_name}},\n\nThank you for your order! We're processing it now and will be in touch with dispatch details shortly.\n\nIf you have any questions, please don't hesitate to get in touch.\n\nThanks,\n{{company_name}}`,
    },
    {
      name: 'Dispatch notification',
      subject: 'Your order is on its way!',
      body: `Hi {{customer_name}},\n\nGreat news — your order has been dispatched and is on its way to you!\n\nIf you have any questions about your delivery, please get in touch.\n\nThanks,\n{{company_name}}`,
    },
  ],
  salon: [
    {
      name: 'Appointment confirmation',
      subject: 'Your appointment is confirmed',
      body: `Hi {{customer_name}},\n\nYour appointment is confirmed. We look forward to seeing you!\n\nIf you need to cancel or rearrange, please give us at least 24 hours notice.\n\nSee you soon,\n{{company_name}}`,
    },
    {
      name: 'Rebooking reminder',
      subject: "Time to book your next appointment",
      body: `Hi {{customer_name}},\n\nIt was lovely seeing you recently! It's time to book your next appointment — get in touch to secure your preferred date and time.\n\nSee you soon,\n{{company_name}}`,
    },
  ],
}

export async function POST(req: NextRequest) {
  try {
    const { company_id, template_type } = await req.json()

    if (!company_id || !template_type) {
      return NextResponse.json({ error: 'Missing company_id or template_type' }, { status: 400 })
    }

    const stages = TEMPLATE_STAGES[template_type] || TEMPLATE_STAGES.removals
    const emailTemplates = TEMPLATE_EMAIL_TEMPLATES[template_type] || []

    // Check if stages already seeded
    const { data: existingStages } = await supabase
      .from('crm_pipeline_stages')
      .select('id')
      .eq('company_id', company_id)
      .limit(1)

    if (!existingStages || existingStages.length === 0) {
      // Seed pipeline stages
      const { error: stagesError } = await supabase
        .from('crm_pipeline_stages')
        .insert(stages.map(s => ({
          company_id,
          name: s.name,
          color: s.color,
          position: s.position,
        })))

      if (stagesError) throw stagesError
    }

    // Seed email templates if table exists
    try {
      const { data: existingTemplates } = await supabase
        .from('email_templates')
        .select('id')
        .eq('company_id', company_id)
        .limit(1)

      if (!existingTemplates || existingTemplates.length === 0) {
        await supabase.from('email_templates').insert(
          emailTemplates.map(t => ({
            company_id,
            name: t.name,
            subject: t.subject,
            body: t.body,
          }))
        )
      }
    } catch {
      // email_templates table might not exist yet, skip silently
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Seed template error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}