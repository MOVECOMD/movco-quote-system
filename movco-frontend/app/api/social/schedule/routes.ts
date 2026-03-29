import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
    const isInternal = req.nextUrl.searchParams.get('internal') === '1'
    if (!isCron && !isInternal) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const now = new Date().toISOString()

    const { data: duePosts } = await supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0

    for (const post of duePosts) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/social/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          content: post.content,
          platforms: post.platforms,
        }),
      })

      if (post.is_recurring && post.recurring_rule) {
        const rule = post.recurring_rule
        const next = new Date()
        if (rule.frequency === 'daily') next.setDate(next.getDate() + 1)
        else if (rule.frequency === 'weekly') next.setDate(next.getDate() + 7)
        else if (rule.frequency === 'monthly') next.setMonth(next.getMonth() + 1)

        await supabase.from('social_posts').insert({
          company_id: post.company_id,
          content: post.content,
          platforms: post.platforms,
          status: 'scheduled',
          scheduled_at: next.toISOString(),
          is_recurring: true,
          recurring_rule: post.recurring_rule,
          ai_generated: post.ai_generated,
        })
      }

      processed++
    }

    return NextResponse.json({ processed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { company_id, content, platforms, scheduled_at, is_recurring, recurring_rule, ai_generated } = await req.json()

    const { data, error } = await supabase.from('social_posts').insert({
      company_id,
      content,
      platforms,
      status: 'scheduled',
      scheduled_at,
      is_recurring: is_recurring || false,
      recurring_rule: recurring_rule || null,
      ai_generated: ai_generated || false,
    }).select().single()

    if (error) throw error
    return NextResponse.json({ success: true, post: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}