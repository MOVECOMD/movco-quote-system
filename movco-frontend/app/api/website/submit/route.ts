import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const website_id = formData.get('website_id') as string
    const type = formData.get('type') as string

    const { data: website } = await supabase
      .from('company_websites')
      .select('company_id')
      .eq('id', website_id)
      .single()

    if (!website) return NextResponse.redirect(new URL('/thank-you', req.url))

    await supabase.from('website_submissions').insert({
      website_id,
      company_id: website.company_id,
      submission_type: type,
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      message: formData.get('message'),
      moving_from: formData.get('moving_from'),
      moving_to: formData.get('moving_to'),
      moving_date: formData.get('moving_date'),
    })

    return NextResponse.redirect(new URL(`/sites/thank-you`, req.url))
  } catch (err: any) {
    console.error('Submit error:', err)
    return NextResponse.redirect(new URL('/sites/thank-you', req.url))
  }
}