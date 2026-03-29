'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

type Action = {
  type: 'send_email' | 'book_event' | 'move_deal' | 'schedule_post' | 'answer' | 'create_pipeline_stage'
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
  "What jobs are coming up this week?",
  "Show pipeline value by stage",
  "What tasks are overdue?",
  "What's booked in the diary this week?",
  "Show me all deals in Quote Sent",
]

export default function AiAssistant() {
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
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      })
      const data = await res.json()

      // Support both single action and array of actions
      const actions = data.actions || (data.action ? [data.action] : [])

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        actions: actions.length > 0 ? actions : undefined,
        requires_confirm: data.requires_confirm,
      }
      setMessages(prev => [...prev, assistantMsg])
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

        } else if (action.type === 'create_pipeline_stage') {
          if (action.data.error) {
            results.push(`✗ Stage creation failed: ${action.data.error}`)
          } else if (action.data.created) {
            results.push(`✓ Pipeline stage "${action.data.name}" created — refresh the page to see it in your pipeline`)
          } else {
            results.push(`✓ Stage "${action.data.name}" processed`)
          }
        }
      } catch (err: any) {
        results.push(`✗ Error: ${err.message}`)
      }
    }

    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, executing: false, executed: true, confirmed: true } : m
    ))
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: results.join('\n'),
    }])
  }

  function getActionPreview(action: Action, idx: number) {
    const colors: Record<string, { bg: string; border: string; title: string; text: string }> = {
      send_email: { bg: '#f0f9f4', border: '#5DCAA5', title: '#085041', text: '#0F6E56' },
      book_event: { bg: '#E6F1FB', border: '#85B7EB', title: '#0C447C', text: '#0C447C' },
      move_deal: { bg: '#EEEDFE', border: '#AFA9EC', title: '#3C3489', text: '#3C3489' },
      schedule_post: { bg: '#FAEEDA', border: '#EF9F27', title: '#633806', text: '#854F0B' },
    }
    const c = colors[action.type] || colors.send_email
    const icons: Record<string, string> = { send_email: '📧', book_event: '📅', move_deal: '🔀', schedule_post: '📱' }

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
          boxShadow: '0 4px 16px rgba(15,110,86,0.4)', transition: 'all 0.2s',
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

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '92px', right: '24px', zIndex: 999,
          width: '420px', height: '600px', maxHeight: 'calc(100vh - 120px)',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
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
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '14px', margin: 0 }}>MOVCO Assistant</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', margin: 0 }}>Ask anything · Execute actions · Voice enabled</p>
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
                  {msg.content}

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
      `}</style>
    </>
  )
}