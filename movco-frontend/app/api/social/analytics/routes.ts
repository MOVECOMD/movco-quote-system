import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

async function fetchFacebookAnalytics(connection: any) {
  if (!connection?.access_token || !connection?.page_id) return null
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${connection.page_id}/insights?metric=page_fans,page_impressions,page_engaged_users&period=day&access_token=${connection.access_token}`
    )
    const data = await res.json()
    if (data.error) return null
    return data.data || []
  } catch { return null }
}

async function fetchInstagramAnalytics(connection: any) {
  if (!connection?.access_token || !connection?.page_id) return null
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${connection.page_id}/insights?metric=follower_count,impressions,reach&period=day&access_token=${connection.access_token}`
    )
    const data = await res.json()
    if (data.error) return null
    return data.data || []
  } catch { return null }
}

async function fetchLinkedInAnalytics(connection: any) {
  if (!connection?.access_token || !connection?.page_id) return null
  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${connection.page_id}`,
      { headers: { Authorization: `Bearer ${connection.access_token}` } }
    )
    const data = await res.json()
    if (data.serviceErrorCode) return null
    return data
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const { data: connections } = await supabase
      .from('social_connections')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('connected', true)

    const connMap: Record<string, any> = {}
    for (const c of connections || []) connMap[c.platform] = c

    const { data: posts } = await supabase
      .from('social_posts')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(20)

    const analytics: Record<string, any> = {
      facebook: null,
      instagram: null,
      linkedin: null,
      posts: posts || [],
    }

    if (connMap.facebook) analytics.facebook = await fetchFacebookAnalytics(connMap.facebook)
    if (connMap.instagram) analytics.instagram = await fetchInstagramAnalytics(connMap.instagram)
    if (connMap.linkedin) analytics.linkedin = await fetchLinkedInAnalytics(connMap.linkedin)

    return NextResponse.json({ analytics })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}