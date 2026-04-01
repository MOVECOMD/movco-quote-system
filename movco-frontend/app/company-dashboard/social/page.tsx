'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: '#1877F2', icon: 'f' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: '📷' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2', icon: 'in' },
]

const AI_PROMPTS = [
  'Just completed a house move in {area} — the team did a brilliant job!',
  'Another successful removal day. Our team works hard so you can settle in faster.',
  'Did you know we offer free no-obligation quotes? Get yours today.',
  'Moving soon? Here are 3 tips to make your move day stress-free...',
  'Proud of our team for another 5-star job this week. Thank you to all our customers!',
]

type Connection = {
  id: string
  platform: string
  connected: boolean
  page_name: string | null
}

type Post = {
  id: string
  content: string
  platforms: string[]
  status: string
  scheduled_at: string | null
  posted_at: string | null
  is_recurring: boolean
  recurring_rule: any
  ai_generated: boolean
  created_at: string
  errors: any
}

export default function SocialPage() {
  const [tab, setTab] = useState<'compose' | 'scheduled' | 'analytics'>('compose')
  const [connections, setConnections] = useState<Connection[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Composer state
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  const [postMode, setPostMode] = useState<'now' | 'schedule'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFreq, setRecurringFreq] = useState('weekly')
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
const [charCount, setCharCount] = useState(0)
const [showMediaModal, setShowMediaModal] = useState(false)
const [mediaFiles, setMediaFiles] = useState<any[]>([])
const [mediaLoading, setMediaLoading] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const connRes = await fetch('/api/social/connect')
      const connData = await connRes.json()
      setConnections(connData.connections || [])
    } catch (err) {
      console.error('Failed to load connections:', err)
      setConnections([])
    }
    try {
      const { data } = await supabase
        .from('social_posts')
        .select('*')
        .eq('company_id', COMPANY_ID)
        .order('created_at', { ascending: false })
        .limit(50)
      setPosts(data || [])
    } catch (err) {
      console.error('Failed to load posts:', err)
      setPosts([])
    }
    setLoading(false)
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true)
    const res = await fetch('/api/social/analytics')
    const data = await res.json()
    setAnalytics(data.analytics)
    setAnalyticsLoading(false)
  }

  async function connectPlatform(platform: string) {
    alert(`${platform} OAuth flow — will redirect to ${platform} login once Meta/LinkedIn API approvals are complete.\n\nFor now, saving a demo connection.`)
    await fetch('/api/social/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        access_token: 'PENDING_APPROVAL',
        page_id: 'PENDING_APPROVAL',
        page_name: `Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} Page (demo)`,
      }),
    })
    loadAll()
  }

  async function disconnectPlatform(platform: string) {
    if (!confirm(`Disconnect ${platform}?`)) return
    await fetch(`/api/social/connect?platform=${platform}`, { method: 'DELETE' })
    loadAll()
  }

  async function generateAiPost() {
    setAiLoading(true)
    try {
      const { data: jobs } = await supabase
        .from('crm_diary_events')
        .select('title, customer_name, location, event_type')
        .eq('company_id', COMPANY_ID)
        .eq('completed', true)
        .order('created_at', { ascending: false })
        .limit(5)

      const jobContext = jobs && jobs.length > 0
        ? jobs.map(j => `${j.event_type} for ${j.customer_name || 'a customer'}${j.location ? ` in ${j.location}` : ''}`).join(', ')
        : 'general removal work'

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Write a short, engaging social media post for a UK removal company. Recent completed jobs: ${jobContext}. 
            
Keep it under 200 characters, professional but friendly, no hashtags needed. Just the post text, nothing else.`
          }]
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || AI_PROMPTS[Math.floor(Math.random() * AI_PROMPTS.length)]
      setContent(text)
      setCharCount(text.length)
    } catch {
      const fallback = AI_PROMPTS[Math.floor(Math.random() * AI_PROMPTS.length)]
      setContent(fallback)
      setCharCount(fallback.length)
    }
     setAiLoading(false)
  }

  async function openMediaLibrary() {
    setShowMediaModal(true)
    setMediaLoading(true)
    const { data } = await supabase
      .from('media_library')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(50)
    setMediaFiles(data || [])
    setMediaLoading(false)
  }

  function insertMediaUrl(url: string) {
    const insertion = `\n${url}`
    setContent(prev => {
      const newVal = prev + insertion
      setCharCount(newVal.length)
      return newVal
    })
    setShowMediaModal(false)
  }


  async function handlePost() {
    if (!content.trim()) return alert('Please write something to post')
    if (selectedPlatforms.length === 0) return alert('Please select at least one platform')
    setPosting(true)
    setPostResult(null)

    if (postMode === 'schedule') {
      if (!scheduledAt) return alert('Please set a date and time')
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: COMPANY_ID,
          content,
          platforms: selectedPlatforms,
          scheduled_at: new Date(scheduledAt).toISOString(),
          is_recurring: isRecurring,
          recurring_rule: isRecurring ? { frequency: recurringFreq } : null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPostResult({ type: 'scheduled', message: `Scheduled for ${new Date(scheduledAt).toLocaleString('en-GB')}` })
        setContent('')
        setCharCount(0)
        loadAll()
      } else {
        setPostResult({ type: 'error', message: data.error })
      }
    } else {
      const { data: postRecord } = await supabase.from('social_posts').insert({
        company_id: COMPANY_ID,
        content,
        platforms: selectedPlatforms,
        status: 'posted',
        posted_at: new Date().toISOString(),
      }).select().single()

      const res = await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postRecord?.id, content, platforms: selectedPlatforms }),
      })
      const data = await res.json()
      setPostResult({
        type: Object.keys(data.errors || {}).length > 0 ? 'partial' : 'success',
        post_ids: data.post_ids,
        errors: data.errors,
      })
      setContent('')
      setCharCount(0)
      loadAll()
    }
    setPosting(false)
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return
    await supabase.from('social_posts').delete().eq('id', id)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  const connectedPlatforms = connections.filter(c => c.connected)
  const scheduledPosts = posts.filter(p => p.status === 'scheduled')
  const postedPosts = posts.filter(p => p.status === 'posted')

  const getPlatformColor = (p: string) => PLATFORMS.find(pl => pl.id === p)?.color || '#888'
  const getPlatformLabel = (p: string) => PLATFORMS.find(pl => pl.id === p)?.label || p

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#666' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>Social Media</h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Schedule and publish posts across Facebook, Instagram and LinkedIn
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {PLATFORMS.map(p => {
            const conn = connections.find(c => c.platform === p.id)
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                background: conn?.connected ? p.color + '18' : 'var(--color-background-secondary)',
                color: conn?.connected ? p.color : 'var(--color-text-secondary)',
                border: `1px solid ${conn?.connected ? p.color + '40' : 'var(--color-border-tertiary)'}`,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: conn?.connected ? p.color : '#ccc' }} />
                {p.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* API approval banner */}
      <div style={{ background: '#FFF8E1', border: '1px solid #FBC02D', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>⏳</span>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#F57F17', margin: 0 }}>Pending API approval</p>
          <p style={{ fontSize: '12px', color: '#F57F17', margin: '2px 0 0', opacity: 0.8 }}>
            Meta and LinkedIn API approvals are in progress. You can connect accounts, compose posts and schedule everything now — posts will fire automatically once approvals land.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', background: 'var(--color-background-secondary)', borderRadius: '10px', padding: '4px' }}>
        {([
          { key: 'compose', label: 'Compose' },
          { key: 'scheduled', label: `Scheduled${scheduledPosts.length > 0 ? ` (${scheduledPosts.length})` : ''}` },
          { key: 'analytics', label: 'Analytics' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'analytics') loadAnalytics() }}
            style={{
              flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? 'var(--color-background-primary)' : 'transparent',
              color: tab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>{t.label}</button>
        ))}
      </div>

      {/* ── COMPOSE TAB ── */}
      {tab === 'compose' && (
        <div style={{ display: 'flex', gap: '20px' }}>

          {/* Left — composer */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Platform selector */}
            <div style={card}>
              <p style={sectionLabel}>Post to</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {PLATFORMS.map(p => {
                  const selected = selectedPlatforms.includes(p.id)
                  const conn = connections.find(c => c.platform === p.id)
                  return (
                    <button key={p.id}
                      onClick={() => setSelectedPlatforms(prev =>
                        prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                      )}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: '8px', border: '2px solid',
                        borderColor: selected ? p.color : 'var(--color-border-tertiary)',
                        background: selected ? p.color + '12' : 'transparent',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        color: selected ? p.color : 'var(--color-text-secondary)',
                      }}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>{p.icon}</div>
                      {p.label}
                      {conn?.connected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color, margin: '4px auto 0' }} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Content area */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={sectionLabel}>Post content</p>
                <div style={{ display: 'flex', gap: '8px' }}>
  <button onClick={generateAiPost} disabled={aiLoading}
    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: '1px solid #7F77DD', background: '#EEEDFE', color: '#534AB7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
    {aiLoading ? '...' : '✨ AI suggest'}
  </button>
  <button onClick={openMediaLibrary}
    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#555', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
    🖼️ Browse Library
  </button>
</div>
              </div>
              <textarea
                value={content}
                onChange={e => { setContent(e.target.value); setCharCount(e.target.value.length) }}
                placeholder="Write your post here, or click AI suggest to generate one based on your recent jobs..."
                rows={6}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border-tertiary)',
                  background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
                  fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: charCount > 280 ? '#e24b4a' : 'var(--color-text-secondary)' }}>
                  {charCount} / 280 chars (Twitter limit — LinkedIn/Facebook allow more)
                </span>
              </div>
            </div>

            {/* Schedule options */}
            <div style={card}>
              <p style={sectionLabel}>When to post</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button onClick={() => setPostMode('now')}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', borderColor: postMode === 'now' ? '#0F6E56' : 'var(--color-border-tertiary)', background: postMode === 'now' ? '#E1F5EE' : 'transparent', color: postMode === 'now' ? '#0F6E56' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Post now
                </button>
                <button onClick={() => setPostMode('schedule')}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid', borderColor: postMode === 'schedule' ? '#0F6E56' : 'var(--color-border-tertiary)', background: postMode === 'schedule' ? '#E1F5EE' : 'transparent', color: postMode === 'schedule' ? '#0F6E56' : 'var(--color-text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Schedule
                </button>
              </div>

              {postMode === 'schedule' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={smallLabel}>Date and time</label>
                    <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" id="recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="recurring" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>Repeat this post</label>
                  </div>
                  {isRecurring && (
                    <select value={recurringFreq} onChange={e => setRecurringFreq(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', fontSize: '14px' }}>
                      <option value="daily">Every day</option>
                      <option value="weekly">Every week</option>
                      <option value="monthly">Every month</option>
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Post result */}
            {postResult && (
              <div style={{
                padding: '12px 16px', borderRadius: '8px',
                background: postResult.type === 'error' ? '#FCEBEB' : postResult.type === 'scheduled' ? '#E1F5EE' : '#E6F1FB',
                border: `1px solid ${postResult.type === 'error' ? '#F09595' : postResult.type === 'scheduled' ? '#5DCAA5' : '#85B7EB'}`,
              }}>
                {postResult.type === 'scheduled' && <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F6E56', margin: 0 }}>✓ {postResult.message}</p>}
                {postResult.type === 'success' && <p style={{ fontSize: '13px', fontWeight: 600, color: '#185FA5', margin: 0 }}>✓ Posted successfully</p>}
                {postResult.type === 'error' && <p style={{ fontSize: '13px', fontWeight: 600, color: '#A32D2D', margin: 0 }}>✗ {postResult.message}</p>}
                {postResult.type === 'partial' && (
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#185FA5', margin: '0 0 4px' }}>Partial success</p>
                    {Object.entries(postResult.errors || {}).map(([p, e]: any) => (
                      <p key={p} style={{ fontSize: '12px', color: '#A32D2D', margin: 0 }}>{getPlatformLabel(p)}: {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={handlePost} disabled={posting || !content.trim() || selectedPlatforms.length === 0}
              style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: posting || !content.trim() ? 0.5 : 1 }}>
              {posting ? 'Posting...' : postMode === 'schedule' ? `Schedule post` : `Post now to ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Right — connections */}
          <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={card}>
              <p style={{ ...sectionLabel, marginBottom: '12px' }}>Connected accounts</p>
              {PLATFORMS.map(p => {
                const conn = connections.find(c => c.platform === p.id)
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border-tertiary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: p.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: p.color }}>
                        {p.icon}
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{p.label}</p>
                        {conn?.connected && conn.page_name && (
                          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>{conn.page_name}</p>
                        )}
                      </div>
                    </div>
                    {conn?.connected ? (
                      <button onClick={() => disconnectPlatform(p.id)}
                        style={{ fontSize: '11px', color: '#e24b4a', background: 'transparent', border: '1px solid #e24b4a', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer' }}>
                        Disconnect
                      </button>
                    ) : (
                      <button onClick={() => connectPlatform(p.id)}
                        style={{ fontSize: '11px', color: p.color, background: p.color + '12', border: `1px solid ${p.color}40`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                        Connect
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Quick tips */}
            <div style={{ ...card, background: '#EEEDFE', border: '1px solid #AFA9EC' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#3C3489', marginBottom: '8px' }}>Best posting times</p>
              <p style={{ fontSize: '11px', color: '#534AB7', margin: '0 0 4px' }}>📘 Facebook: Tue–Thu, 9am–3pm</p>
              <p style={{ fontSize: '11px', color: '#534AB7', margin: '0 0 4px' }}>📷 Instagram: Mon–Fri, 11am–1pm</p>
              <p style={{ fontSize: '11px', color: '#534AB7', margin: 0 }}>💼 LinkedIn: Tue–Thu, 8am–10am</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULED TAB ── */}
      {tab === 'scheduled' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {scheduledPosts.length === 0 && postedPosts.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
              <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>No posts yet</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>Schedule your first post from the Compose tab</p>
            </div>
          ) : (
            <>
              {scheduledPosts.length > 0 && (
                <div>
                  <p style={{ ...sectionLabel, marginBottom: '10px' }}>Upcoming ({scheduledPosts.length})</p>
                  {scheduledPosts.map(post => (
                    <PostCard key={post.id} post={post} onDelete={deletePost} getPlatformColor={getPlatformColor} getPlatformLabel={getPlatformLabel} />
                  ))}
                </div>
              )}
              {postedPosts.length > 0 && (
                <div>
                  <p style={{ ...sectionLabel, marginBottom: '10px' }}>Posted history</p>
                  {postedPosts.slice(0, 10).map(post => (
                    <PostCard key={post.id} post={post} onDelete={deletePost} getPlatformColor={getPlatformColor} getPlatformLabel={getPlatformLabel} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && (
        <div>
          {analyticsLoading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
              <p>Loading analytics...</p>
            </div>
          ) : !analytics ? (
            <div style={{ ...card, textAlign: 'center', padding: '48px' }}>
              <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>Analytics unavailable</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
                Connect your accounts and analytics will appear here once Meta and LinkedIn API approvals are complete.
              </p>
              <button onClick={loadAnalytics}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Refresh
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Platform stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {PLATFORMS.map(p => {
                  const conn = connections.find(c => c.platform === p.id)
                  const data = analytics[p.id]
                  return (
                    <div key={p.id} style={{ ...card, borderTop: `3px solid ${p.color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: p.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: p.color }}>
                          {p.icon}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.label}</span>
                      </div>
                      {!conn?.connected ? (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Not connected</p>
                      ) : !data ? (
                        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Pending API approval</p>
                      ) : (
                        <div>
                          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>—</p>
                          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>Data loading after approval</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Post performance */}
              <div style={card}>
                <p style={{ ...sectionLabel, marginBottom: '12px' }}>Post performance</p>
                {(analytics.posts || []).length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 0' }}>No posts yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(analytics.posts || []).slice(0, 5).map((post: Post) => (
                      <div key={post.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.content}</p>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {post.platforms.map(pl => (
                              <span key={pl} style={{ fontSize: '10px', fontWeight: 600, color: getPlatformColor(pl), background: getPlatformColor(pl) + '15', padding: '2px 6px', borderRadius: '4px' }}>
                                {getPlatformLabel(pl)}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                          {post.posted_at ? new Date(post.posted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PostCard({ post, onDelete, getPlatformColor, getPlatformLabel }: {
  post: Post
  onDelete: (id: string) => void
  getPlatformColor: (p: string) => string
  getPlatformLabel: (p: string) => string
}) {
  return (
    <div style={{ ...card, marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {post.platforms.map(p => (
            <span key={p} style={{ fontSize: '11px', fontWeight: 600, color: getPlatformColor(p), background: getPlatformColor(p) + '15', padding: '2px 8px', borderRadius: '20px', border: `1px solid ${getPlatformColor(p)}30` }}>
              {getPlatformLabel(p)}
            </span>
          ))}
          {post.ai_generated && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#534AB7', background: '#EEEDFE', padding: '2px 8px', borderRadius: '20px' }}>✨ AI</span>
          )}
          {post.is_recurring && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '2px 8px', borderRadius: '20px' }}>🔁 Recurring</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
            background: post.status === 'scheduled' ? '#E6F1FB' : post.status === 'posted' ? '#E1F5EE' : '#FCEBEB',
            color: post.status === 'scheduled' ? '#185FA5' : post.status === 'posted' ? '#0F6E56' : '#A32D2D',
          }}>
            {post.status}
          </span>
          <button onClick={() => onDelete(post.id)}
            style={{ background: 'transparent', border: 'none', color: '#e24b4a', cursor: 'pointer', fontSize: '12px', padding: '2px 6px' }}>
            Delete
          </button>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '0 0 6px', lineHeight: 1.5 }}>{post.content}</p>
      <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: 0 }}>
        {post.status === 'scheduled' && post.scheduled_at
          ? `Scheduled for ${new Date(post.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
          : post.posted_at
          ? `Posted ${new Date(post.posted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : `Created ${new Date(post.created_at).toLocaleDateString('en-GB')}`
        }
          </p>
    </div>
  )
}

const card: React.CSSProperties = {
  background: 'var(--color-background-secondary)',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: '12px',
  padding: '16px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: 0,
}

const smallLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
}