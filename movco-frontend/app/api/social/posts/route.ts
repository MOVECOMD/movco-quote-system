import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// company_id now comes from request params

async function postToFacebook(content: string, connection: any) {
  if (!connection?.access_token || !connection?.page_id) {
    return { success: false, error: 'Not connected — pending Meta API approval' }
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${connection.page_id}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, access_token: connection.access_token }),
    })
    const data = await res.json()
    if (data.id) return { success: true, post_id: data.id }
    return { success: false, error: data.error?.message || 'Unknown error' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function postToInstagram(content: string, connection: any) {
  if (!connection?.access_token || !connection?.page_id) {
    return { success: false, error: 'Not connected — pending Meta API approval' }
  }
  try {
    const containerRes = await fetch(`https://graph.facebook.com/v18.0/${connection.page_id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: content, media_type: 'REELS', access_token: connection.access_token }),
    })
    const container = await containerRes.json()
    if (!container.id) return { success: false, error: container.error?.message || 'Container creation failed' }

    const publishRes = await fetch(`https://graph.facebook.com/v18.0/${connection.page_id}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id, access_token: connection.access_token }),
    })
    const publish = await publishRes.json()
    if (publish.id) return { success: true, post_id: publish.id }
    return { success: false, error: publish.error?.message || 'Publish failed' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function postToLinkedIn(content: string, connection: any) {
  if (!connection?.access_token || !connection?.page_id) {
    return { success: false, error: 'Not connected — pending LinkedIn API approval' }
  }
  try {
    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:organization:${connection.page_id}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })
    const data = await res.json()
    if (data.id) return { success: true, post_id: data.id }
    return { success: false, error: data.message || 'Unknown error' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { post_id, content, platforms, company_id } = await req.json()
    if (!company_id) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    const { data: connections } = await supabase
      .from('social_connections')
      .select('*')
      .eq('company_id', req.nextUrl.searchParams.get('company_id')!)
      .eq('connected', true)

    const connMap: Record<string, any> = {}
    for (const c of connections || []) connMap[c.platform] = c

    const post_ids: Record<string, string> = {}
    const errors: Record<string, string> = {}

    for (const platform of platforms) {
      let result: any
      if (platform === 'facebook') result = await postToFacebook(content, connMap.facebook)
      else if (platform === 'instagram') result = await postToInstagram(content, connMap.instagram)
      else if (platform === 'linkedin') result = await postToLinkedIn(content, connMap.linkedin)
      else continue

      if (result.success) post_ids[platform] = result.post_id
      else errors[platform] = result.error
    }

    const allFailed = platforms.every((p: string) => errors[p])
    const status = allFailed ? 'failed' : 'posted'

    if (post_id) {
      await supabase.from('social_posts').update({
        status, post_ids, errors, posted_at: new Date().toISOString()
      }).eq('id', post_id)
    }

    return NextResponse.json({ success: !allFailed, post_ids, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}