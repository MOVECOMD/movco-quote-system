import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const companyId = formData.get('company_id') as string
    const tags = formData.get('tags') as string

    if (!file || !companyId) {
      return NextResponse.json({ error: 'Missing file or company_id' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()
    const fileName = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('crm-files')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('crm-files')
      .getPublicUrl(fileName)

    const { error: dbError } = await supabase.from('media_library').insert({
      company_id: companyId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
      tags: tags ? JSON.parse(tags) : [],
    })

    if (dbError) throw dbError

    return NextResponse.json({ success: true, url: urlData.publicUrl })
  } catch (err: any) {
    console.error('Media upload error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}