'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

import { useAuth } from '@/context/AuthContext'

type Action = {
  type: string
  data: any
  label?: string
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: Action[]
  requires_confirm?: boolean
  confirmed?: boolean
  executed?: boolean
  executing?: boolean
}

const QUICK_COMMANDS = [
  "What's my revenue this month?",
  "What's coming up this week?",
  "Show pipeline value by stage",
  "What tasks are overdue?",
  "Add a new customer",
  "Help me configure my CRM",
]

export default function AiAssistant() {
  const { companyId: COMPANY_ID } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [emailConnected, setEmailConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (open) {
      checkEmail()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function checkEmail() {
    try {
      const res = await fetch(`/api/email/status?company_id=${COMPANY_ID}`)
      const data = await res.json()
      console.log('AI RESPONSE:', JSON.stringify(data).substring(0, 500))
      if (data.actions) {
        data.actions = data.actions.map((a: any) => {
          if (a.type === 'edit_website' && a.data?.custom_html) {
            a.data.custom_html = '[HTML_SAVED]'
          }
          return a
        })
      }
      if (data.message) {
        data.message = data.message
      }
      setEmailConnected(data.connected)
    } catch { }
  }

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice input not supported in this browser. Try Chrome.'); return }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-GB'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setTimeout(() => sendMessage(transcript), 300)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function sendMessage(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      console.log('SENDING COMPANY_ID:', COMPANY_ID)
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          company_id: COMPANY_ID,
        }),
      })
      const data = await res.json()

      const actions = data.actions || (data.action ? [data.action] : [])

      const serverSideActions = [
        'create_customer', 'edit_customer', 'delete_customer', 'merge_customers',
        'create_deal', 'edit_deal', 'delete_deal',
        'create_pipeline', 'create_pipeline_stage', 'edit_stage', 'delete_stage', 'edit_pipeline', 'delete_pipeline',
        'add_note', 'add_task', 'complete_task', 'delete_task',
        'edit_event', 'delete_event', 'complete_event',
        'create_quote', 'edit_quote', 'update_quote_status', 'convert_quote_to_deal',
        'update_event_types', 'update_customer_fields', 'update_terminology', 'toggle_feature_flag', 'change_industry',
        'update_company', 'update_coverage', 'update_working_hours',
        'publish_website', 'update_website_settings',
        'create_email_template',
        'edit_social_post', 'delete_social_post',
        'create_automation', 'edit_automation', 'delete_automation', 'toggle_automation',
      ]
      const clientConfirmActions = ['send_email', 'bulk_email', 'book_event', 'move_deal', 'schedule_post', 'send_quote_email']
      const hasClientAction = actions.some((a: Action) => clientConfirmActions.includes(a.type))
      const hasServerSideOnly = actions.length > 0 && actions.every((a: Action) => serverSideActions.includes(a.type)) && !hasClientAction
      const hasWebsiteEdit = actions.some((a: Action) => a.type === 'edit_website')
      const hasAnyActions = actions.length > 0

      const cleanMsg = (data.message || '✓ Done')
        .replace(/\{[\s\S]*"actions"[\s\S]*\}/g, '')
        .replace(/<!DOCTYPE[\s\S]*?<\/html>/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim() || '✓ Done'

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanMsg,
        actions: actions.length > 0 ? actions : undefined,
        requires_confirm: hasClientAction ? true : hasServerSideOnly ? false : data.requires_confirm,
      }

      setMessages(prev => [...prev, assistantMsg])

      // Website edits are already done server-side — just notify the editor to refresh
      if (hasWebsiteEdit) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: '✅ Website updated! Refresh the preview to see changes.',
          }])
          window.dispatchEvent(new Event('website-updated'))
        }, 500)
      }
      // Client-side actions (email, booking, move, schedule) wait for user to confirm

      if (hasServerSideOnly) {
        const results = actions.map((a: Action) => {
          if (a.data?.error) return `✗ Failed: ${a.data.error}`
          if (a.type === 'create_deal') return `✓ ${a.data.customer_name} added to pipeline`
          if (a.type === 'create_customer') return `✓ ${a.data.name} created as a contact`
          if (a.type === 'edit_customer') return `✓ ${a.data.customer_name} updated`
          if (a.type === 'delete_customer') return `✓ ${a.data.customer_name} deleted`
          if (a.type === 'merge_customers') return `✓ ${a.data.merge_name} merged into ${a.data.keep_name}`
          if (a.type === 'edit_deal') return `✓ ${a.data.deal_name} updated`
          if (a.type === 'delete_deal') return `✓ ${a.data.deal_name} deleted`
          if (a.type === 'add_note') return `✓ Note added for ${a.data.customer_name}`
          if (a.type === 'add_task') return `✓ Task added for ${a.data.customer_name}`
          if (a.type === 'complete_task') return `✓ Task "${a.data.task_title}" completed`
          if (a.type === 'delete_task') return `✓ Task "${a.data.task_title}" deleted`
          if (a.type === 'create_pipeline_stage') return `✓ Stage "${a.data.name}" created`
          if (a.type === 'edit_stage') return `✓ Stage updated`
          if (a.type === 'delete_stage') return `✓ Stage "${a.data.stage_name}" deleted`
          if (a.type === 'create_pipeline') return `✓ Pipeline "${a.data.name}" created`
          if (a.type === 'edit_pipeline') return `✓ Pipeline updated`
          if (a.type === 'delete_pipeline') return `✓ Pipeline "${a.data.pipeline_name}" deleted`
          if (a.type === 'edit_event') return `✓ "${a.data.event_title}" updated`
          if (a.type === 'delete_event') return `✓ "${a.data.event_title}" cancelled`
          if (a.type === 'complete_event') return `✓ "${a.data.event_title}" marked complete`
          if (a.type === 'create_quote') return `✓ Quote created for ${a.data.customer_name}`
          if (a.type === 'edit_quote') return `✓ Quote updated`
          if (a.type === 'update_quote_status') return `✓ ${a.data.customer_name}'s quote → ${a.data.new_status}`
          if (a.type === 'convert_quote_to_deal') return `✓ ${a.data.customer_name}'s quote converted to deal`
          if (a.type === 'update_event_types') return `✓ Event types updated`
          if (a.type === 'update_customer_fields') return `✓ Custom fields updated`
          if (a.type === 'update_terminology') return `✓ Sidebar labels updated — refresh to see changes`
          if (a.type === 'toggle_feature_flag') return `✓ Feature flag "${a.data.flag}" ${a.data.enabled ? 'enabled' : 'disabled'}`
          if (a.type === 'change_industry') return `✓ Industry changed to ${a.data.new_template_type} — refresh to see changes`
          if (a.type === 'update_company') return `✓ Company details updated`
          if (a.type === 'update_coverage') return `✓ Coverage areas updated`
          if (a.type === 'update_working_hours') return `✓ Working hours updated`
          if (a.type === 'publish_website') return `✓ Website ${a.data.published ? 'published' : 'unpublished'}`
          if (a.type === 'update_website_settings') return `✓ Website settings updated`
          if (a.type === 'bulk_email') return `✓ Bulk email sent to ${a.data.recipients?.length || 0} recipients`
          if (a.type === 'create_email_template') return `✓ Email template "${a.data.name}" saved`
          if (a.type === 'edit_social_post') return `✓ Post updated`
          if (a.type === 'delete_social_post') return `✓ Post deleted`
          if (a.type === 'create_automation') return `✓ Automation "${a.data.name}" created`
          if (a.type === 'edit_automation') return `✓ Automation updated`
          if (a.type === 'delete_automation') return `✓ Automation "${a.data.automation_name}" deleted`
          if (a.type === 'toggle_automation') return `✓ Automation "${a.data.automation_name}" ${a.data.enabled ? 'enabled' : 'disabled'}`
          if (a.type === 'add_tag') return `✓ Tagged ${a.data.customer_name} as "${a.data.tag}"`
          if (a.type === 'remove_tag') return `✓ Removed "${a.data.tag}" from ${a.data.customer_name}`
          if (a.type === 'bulk_add_tag') return `✓ Tagged ${a.data.tagged_count || a.data.customer_ids?.length || 0} contacts as "${a.data.tag}"`
          if (a.type === 'update_sources') return `✓ Contact sources updated`
          return `✓ Done`
        })
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: results.join('\n') + '\n\n✅ Page refreshing in 2 seconds...',
          }])
          setTimeout(() => window.location.reload(), 2000)
        }, 300)
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    }
    setLoading(false)
  }

  async function executeActions(msgId: string, actions: Action[]) {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, executing: true } : m))
    const results: string[] = []

    for (const action of actions) {
      try {
        if (action.type === 'send_email') {
          const res = await fetch('/api/email/send-custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_id: COMPANY_ID,
              recipient_email: action.data.to_email,
              recipient_name: action.data.to_name,
              subject: action.data.subject,
              body_text: action.data.body,
            }),
          })
          const data = await res.json()
          results.push(data.success ? `✓ Email sent to ${action.data.to_name}` : `✗ Email failed: ${data.error}`)

        } else if (action.type === 'book_event') {
          const { error } = await supabase.from('crm_diary_events').insert({
            company_id: COMPANY_ID,
            title: action.data.title,
            event_type: action.data.event_type,
            start_time: action.data.start_time,
            end_time: action.data.end_time || null,
            customer_name: action.data.customer_name || null,
            location: action.data.location || null,
            deal_id: action.data.deal_id || null,
            color: '#3b82f6',
            completed: false,
          })
          results.push(error ? `✗ Booking failed: ${error.message}` : `✓ Booked: ${action.data.title}`)

        } else if (action.type === 'move_deal') {
          const { error } = await supabase.from('crm_deals')
            .update({ stage_id: action.data.new_stage_id, updated_at: new Date().toISOString() })
            .eq('id', action.data.deal_id)
          results.push(error ? `✗ Move failed: ${error.message}` : `✓ ${action.data.deal_name} → ${action.data.new_stage_name}`)

        } else if (action.type === 'schedule_post') {
          const { error } = await supabase.from('social_posts').insert({
            company_id: COMPANY_ID,
            content: action.data.content,
            platforms: action.data.platforms,
            status: action.data.scheduled_at ? 'scheduled' : 'posted',
            scheduled_at: action.data.scheduled_at || null,
            posted_at: action.data.scheduled_at ? null : new Date().toISOString(),
          })
          results.push(error ? `✗ Post failed: ${error.message}` : `✓ Post ${action.data.scheduled_at ? 'scheduled' : 'saved'}`)

        } else if (action.type === 'bulk_email') {
          let sent = 0, failed = 0
          for (const r of (action.data.recipients || [])) {
            try {
              const res = await fetch('/api/email/send-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  company_id: COMPANY_ID,
                  recipient_email: r.email,
                  recipient_name: r.name,
                  subject: action.data.subject,
                  body_text: (action.data.body_template || '').replace(/\{\{name\}\}/g, r.name).replace(/\{name\}/g, r.name),
                }),
              })
              if (res.ok) sent++; else failed++
            } catch { failed++ }
          }
          results.push(sent > 0 ? `✓ ${sent} emails sent${failed > 0 ? `, ${failed} failed` : ''}` : `✗ All ${failed} emails failed`)

        } else if (action.type === 'create_pipeline_stage') {
          if (action.data.error) {
            results.push(`✗ Stage creation failed: ${action.data.error}`)
          } else if (action.data.created) {
            results.push(`✓ Pipeline stage "${action.data.name}" created — refresh the page to see it in your pipeline`)
          } else {
            results.push(`✓ Stage "${action.data.name}" processed`)
          }

        } else if (action.type === 'edit_website') {
          if (action.data.error) {
            results.push(`⚠️ ${action.data.error}`)
          } else if (action.data.suggestions_only) {
            results.push(`💡 Suggestions ready`)
          } else if (action.data.built) {
            results.push(`✓ Website built successfully`)
          } else if (action.data.html_set) {
            const editResults = action.data.edit_results
            if (editResults) {
              if (editResults.failed > 0 && editResults.applied > 0) {
                results.push(`⚠️ ${action.data.partial_warning || `${editResults.applied}/${editResults.total_operations} changes applied. Some edits couldn't be matched.`}`)
              } else {
                results.push(`✓ ${editResults.applied} edit${editResults.applied !== 1 ? 's' : ''} applied successfully`)
              }
            } else {
              results.push(`✓ HTML updated`)
            }
            if (action.data.can_undo) {
              results.push(`↩️ You can undo this change using the button in the editor sidebar.`)
            }
          } else if (action.data.theme_updated) {
            results.push(`✓ Theme colours updated`)
            if (action.data.can_undo) {
              results.push(`↩️ You can undo this change using the button in the editor sidebar.`)
            }
          } else if (action.data.added) {
            results.push(`✓ New section added to your website`)
          } else if (action.data.removed) {
            results.push(`✓ Section removed from your website`)
          } else {
            results.push(`✓ Website updated`)
          }
        }
      } catch (err: any) {
        results.push(`✗ Error: ${err.message}`)
      }
    }

    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, executing: false, executed: true, confirmed: true } : m
    ))
    const needsRefresh = actions.some(a => 
      ['create_customer', 'edit_customer', 'delete_customer', 'merge_customers',
       'create_deal', 'edit_deal', 'delete_deal', 'move_deal',
       'create_pipeline_stage', 'edit_stage', 'delete_stage', 'create_pipeline', 'edit_pipeline', 'delete_pipeline',
       'add_note', 'add_task', 'complete_task', 'delete_task',
       'book_event', 'edit_event', 'delete_event', 'complete_event',
       'create_quote', 'edit_quote', 'update_quote_status', 'convert_quote_to_deal',
       'edit_website', 'publish_website', 'update_website_settings',
       'update_terminology', 'toggle_feature_flag', 'change_industry',
       'update_company', 'update_coverage',
       'edit_social_post', 'delete_social_post',
       'create_automation', 'edit_automation', 'delete_automation', 'toggle_automation',
       'add_tag', 'remove_tag', 'bulk_add_tag', 'update_sources',
      ].includes(a.type)
    )

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: results.join('\n') + (needsRefresh ? '\n\n✅ Done! The page will refresh in 2 seconds to show your changes.' : ''),
    }])

    if (needsRefresh) {
      setTimeout(() => window.location.reload(), 2000)
    }
  }

  function getActionPreview(action: Action, idx: number) {
    const colors: Record<string, { bg: string; border: string; title: string; text: string }> = {
      send_email: { bg: '#f0f9f4', border: '#5DCAA5', title: '#085041', text: '#0F6E56' },
      book_event: { bg: '#E6F1FB', border: '#85B7EB', title: '#0C447C', text: '#0C447C' },
      move_deal: { bg: '#EEEDFE', border: '#AFA9EC', title: '#3C3489', text: '#3C3489' },
      schedule_post: { bg: '#FAEEDA', border: '#EF9F27', title: '#633806', text: '#854F0B' },
      bulk_email: { bg: '#f0f9f4', border: '#5DCAA5', title: '#085041', text: '#0F6E56' },
    }
    const c = colors[action.type] || colors.send_email
    const icons: Record<string, string> = { send_email: '📧', book_event: '📅', move_deal: '🔀', schedule_post: '📱', bulk_email: '📧' }

    return (
      <div key={idx} style={{ marginTop: '8px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '10px', fontSize: '12px' }}>
        <p style={{ fontWeight: 700, color: c.title, margin: '0 0 4px' }}>{icons[action.type]} {action.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
        {action.type === 'send_email' && (
          <>
            <p style={{ color: c.text, margin: '0 0 2px' }}>To: {action.data.to_name} &lt;{action.data.to_email}&gt;</p>
            <p style={{ color: c.text, margin: '0 0 4px' }}>Subject: {action.data.subject}</p>
            <p style={{ color: c.text, margin: 0, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{action.data.body}</p>
          </>
        )}
        {action.type === 'book_event' && (
          <>
            <p style={{ color: c.text, margin: '0 0 2px' }}>Title: {action.data.title}</p>
            <p style={{ color: c.text, margin: '0 0 2px' }}>Type: {action.data.event_type}</p>
            <p style={{ color: c.text, margin: 0 }}>When: {new Date(action.data.start_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          </>
        )}
        {action.type === 'move_deal' && (
          <p style={{ color: c.text, margin: 0 }}>{action.data.deal_name} → {action.data.new_stage_name}</p>
        )}
        {action.type === 'schedule_post' && (
          <>
            <p style={{ color: c.text, margin: '0 0 4px' }}>{action.data.content}</p>
            <p style={{ color: c.text, margin: 0, fontSize: '11px' }}>Platforms: {action.data.platforms?.join(', ')}{action.data.scheduled_at ? ` · ${new Date(action.data.scheduled_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ' · Post now'}</p>
          </>
        )}
        {action.type === 'bulk_email' && (
          <>
            <p style={{ color: c.text, margin: '0 0 2px' }}>To: {action.data.recipients?.length || 0} recipients</p>
            <p style={{ color: c.text, margin: '0 0 4px' }}>Subject: {action.data.subject}</p>
            <p style={{ color: c.text, margin: 0, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{action.data.body_template?.substring(0, 200)}</p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: '56px', height: '56px', borderRadius: '50%',
          background: open ? '#085041' : '#0F6E56',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: loading && open
            ? '0 4px 16px rgba(15,110,86,0.4), 0 0 20px rgba(15,110,86,0.5), 0 0 40px rgba(15,110,86,0.2)'
            : '0 4px 16px rgba(15,110,86,0.4)',
          transition: 'all 0.3s',
          animation: loading && open ? 'buttonPulse 2s ease-in-out infinite' : 'none',
        }}
        title="AI Assistant"
      >
        {open ? (
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        )}
      </button>

      {/* Glow effect behind chat panel */}
      {open && loading && (
        <div style={{
          position: 'fixed', bottom: '80px', right: '12px', zIndex: 998,
          width: '444px', height: '624px', maxHeight: 'calc(100vh - 108px)',
          borderRadius: '20px',
          background: 'radial-gradient(ellipse at center, rgba(15,110,86,0.35) 0%, rgba(15,110,86,0) 70%)',
          animation: 'chatGlow 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '92px', right: '24px', zIndex: 999,
          width: '420px', height: '600px', maxHeight: 'calc(100vh - 120px)',
          background: '#ffffff',
          border: loading ? '1px solid rgba(15,110,86,0.4)' : '1px solid #e5e7eb',
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
          boxShadow: loading
            ? '0 8px 40px rgba(0,0,0,0.2), 0 0 30px rgba(15,110,86,0.25), 0 0 60px rgba(15,110,86,0.1)'
            : '0 8px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
        }}>

          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#0F6E56', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '14px', margin: 0 }}>BYM Assistant</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', margin: 0 }}>Configure · Manage · Automate</p>
              </div>
              <button onClick={() => setMessages([])} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '6px' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f9fafb' }}>
            {messages.length === 0 && (
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', textAlign: 'center' }}>
                  Good morning! What do you need to do today?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {QUICK_COMMANDS.map((cmd, i) => (
                    <button key={i} onClick={() => sendMessage(cmd)}
                      style={{
                        textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
                        background: '#ffffff', color: '#374151',
                        fontSize: '12px', cursor: 'pointer',
                      }}>
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#0F6E56' : '#ffffff',
                  color: msg.role === 'user' ? '#fff' : '#111827',
                  fontSize: '13px', lineHeight: 1.5,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-line',
                }}>
                  {msg.content
                    .replace(/```json[\s\S]*?```/g, '')
                    .replace(/```[\s\S]*?```/g, '')
                    .replace(/"custom_html":\s*"[^"\\]*(?:\\.[^"\\]*)*"/g, '"custom_html":"[HTML_SAVED]"')
                    .replace(/<!DOCTYPE[\s\S]*?<\/html>/gi, '[HTML_SAVED]')
                    .trim() || msg.content}

                  {/* Multi-action previews */}
                  {msg.actions && !msg.executed && msg.actions.filter(a => a.type !== 'answer').map((action, idx) => getActionPreview(action, idx))}

                  {/* Confirm buttons */}
                  {msg.actions && msg.actions.some(a => a.type !== 'answer') && msg.requires_confirm && !msg.executed && !msg.confirmed && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button
                        onClick={() => executeActions(msg.id, msg.actions!.filter(a => a.type !== 'answer'))}
                        disabled={msg.executing}
                        style={{
                          flex: 1, padding: '7px', borderRadius: '8px', border: 'none',
                          background: '#0F6E56', color: '#fff', fontSize: '12px', fontWeight: 700,
                          cursor: msg.executing ? 'wait' : 'pointer',
                        }}
                      >
                        {msg.executing ? 'Running...' : `✓ Confirm ${msg.actions.filter(a => a.type !== 'answer').length > 1 ? `all ${msg.actions.filter(a => a.type !== 'answer').length} actions` : ''}`}
                      </button>
                      <button
                        onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, confirmed: false, executed: true } : m))}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {msg.executed && msg.confirmed && msg.actions && (
                    <p style={{ fontSize: '11px', color: '#0F6E56', margin: '6px 0 0', fontWeight: 600 }}>✓ Done</p>
                  )}
                  {msg.executed && !msg.confirmed && msg.actions && (
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: '6px 0 0' }}>Cancelled</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#ffffff', display: 'flex', gap: '4px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#0F6E56',
                      animation: 'bounce 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', flexShrink: 0, background: '#ffffff' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Send follow up to John, move Alan to Booked..."
                rows={2}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  color: '#111827',
                  fontSize: '13px', fontFamily: 'inherit', resize: 'none',
                  outline: 'none', lineHeight: 1.4,
                }}
              />
              {/* Voice button */}
              <button
                onClick={listening ? stopVoice : startVoice}
                style={{
                  width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                  background: listening ? '#e24b4a' : '#f3f4f6',
                  color: listening ? '#fff' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.15s',
                  animation: listening ? 'pulse 1s ease-in-out infinite' : 'none',
                }}
                title={listening ? 'Stop listening' : 'Voice input'}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                </svg>
              </button>
              {/* Send button */}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                style={{
                  width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                  background: input.trim() && !loading ? '#0F6E56' : '#f3f4f6',
                  color: input.trim() && !loading ? '#fff' : '#9ca3af',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p style={{ fontSize: '10px', color: '#9ca3af', margin: '6px 0 0', textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line · 🎤 voice
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes chatGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes buttonPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(15,110,86,0.4), 0 0 20px rgba(15,110,86,0.3); }
          50% { box-shadow: 0 4px 16px rgba(15,110,86,0.6), 0 0 30px rgba(15,110,86,0.5), 0 0 50px rgba(15,110,86,0.2); }
        }
      `}</style>
    </>
  )
}
