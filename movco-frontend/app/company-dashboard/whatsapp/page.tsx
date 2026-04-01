'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@/context/AuthContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)



type WaMessage = {
  id: string
  customer_id: string | null
  customer_phone: string
  customer_name: string
  direction: 'inbound' | 'outbound'
  message_text: string
  template_name: string | null
  status: string
  created_at: string
}

type Template = {
  id: string
  name: string
  category: string
  message_text: string
  variables: string[]
}

type Conversation = {
  phone: string
  name: string
  customer_id: string | null
  last_message: string
  last_time: string
  unread: number
  messages: WaMessage[]
}

export default function WhatsAppPage() {
  const { companyId: COMPANY_ID } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkStage, setBulkStage] = useState('')
  const [bulkTemplate, setBulkTemplate] = useState('')
  const [bulkVars, setBulkVars] = useState<Record<string, string>>({})
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null)
  const [newChatPhone, setNewChatPhone] = useState('')
  const [newChatName, setNewChatName] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [apiConnected, setApiConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadAll() }, [])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [selectedPhone, conversations])

  async function loadAll() {
    setLoading(true)
    const [msgsRes, tplRes, custRes, stagesRes, dealsRes] = await Promise.all([
      supabase.from('whatsapp_messages').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: true }),
      supabase.from('whatsapp_templates').select('*').eq('company_id', COMPANY_ID),
      supabase.from('crm_customers').select('id, name, phone').eq('company_id', COMPANY_ID),
      supabase.from('crm_pipeline_stages').select('id, name, color').eq('company_id', COMPANY_ID).order('position'),
      supabase.from('crm_deals').select('id, customer_name, customer_phone, customer_id, stage_id').eq('company_id', COMPANY_ID),
    ])

    setTemplates(tplRes.data || [])
    setCustomers(custRes.data || [])
    setStages(stagesRes.data || [])
    setDeals(dealsRes.data || [])

    // Check if API is connected
    setApiConnected(false) // Will be true once env vars are set

    // Group messages into conversations
    const msgs = msgsRes.data || []
    const convMap = new Map<string, Conversation>()
    for (const msg of msgs) {
      const phone = msg.customer_phone
      if (!convMap.has(phone)) {
        convMap.set(phone, {
          phone,
          name: msg.customer_name || phone,
          customer_id: msg.customer_id,
          last_message: msg.message_text,
          last_time: msg.created_at,
          unread: 0,
          messages: [],
        })
      }
      const conv = convMap.get(phone)!
      conv.messages.push(msg)
      conv.last_message = msg.message_text
      conv.last_time = msg.created_at
      if (msg.direction === 'inbound') conv.unread++
    }

    setConversations(Array.from(convMap.values()).sort((a, b) =>
      new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    ))
    setLoading(false)
  }

  const selectedConv = conversations.find(c => c.phone === selectedPhone)

  async function sendMessage(text?: string, templateName?: string) {
    const toSend = text || message
    if (!toSend.trim() || !selectedConv) return
    setSending(true)

    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_phone: selectedConv.phone,
        to_name: selectedConv.name,
        customer_id: selectedConv.customer_id,
        message_text: toSend,
        template_name: templateName || null,
      }),
    })

    if (res.ok) {
      setMessage('')
      setShowTemplates(false)
      await loadAll()
    }
    setSending(false)
  }

  function applyTemplate(tpl: Template) {
    let text = tpl.message_text
    if (selectedConv) {
      text = text.replace('{{name}}', selectedConv.name.split(' ')[0])
    }
    setMessage(text)
    setShowTemplates(false)
  }

  async function sendBulk() {
    if (!bulkStage || !bulkTemplate) return
    setBulkSending(true)
    setBulkResult(null)

    const tpl = templates.find(t => t.id === bulkTemplate)
    if (!tpl) return

    const stageDeals = deals.filter(d => d.stage_id === bulkStage)
    let sent = 0, failed = 0

    for (const deal of stageDeals) {
      const phone = deal.customer_phone
      if (!phone) { failed++; continue }

      let text = tpl.message_text
        .replace('{{name}}', deal.customer_name?.split(' ')[0] || 'there')
      Object.entries(bulkVars).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v)
      })

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_phone: phone,
          to_name: deal.customer_name,
          customer_id: deal.customer_id,
          message_text: text,
          template_name: tpl.name,
        }),
      })
      res.ok ? sent++ : failed++
      await new Promise(r => setTimeout(r, 200))
    }

    setBulkSending(false)
    setBulkResult({ sent, failed })
    await loadAll()
  }

  async function startNewChat() {
    if (!newChatPhone.trim()) return
    const phone = newChatPhone.replace(/\D/g, '').replace(/^0/, '44')
    const customer = customers.find(c => c.phone?.replace(/\D/g, '').replace(/^0/, '44') === phone)
    setSelectedPhone(phone)
    setShowNewChat(false)
    setNewChatPhone('')
    setNewChatName('')
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#666' }}>Loading WhatsApp...</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f2f5', fontFamily: 'system-ui, sans-serif' }}>

      {/* Left sidebar — conversations */}
      <div style={{ width: '360px', flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#0F6E56' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>💬</span>
              <div>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: '16px', margin: 0 }}>WhatsApp</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', margin: 0 }}>
                  {apiConnected ? '🟢 Connected' : '🟡 API not connected yet'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowBulk(true)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                📢 Bulk
              </button>
              <button onClick={() => setShowNewChat(true)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                ✏️ New
              </button>
            </div>
          </div>
        </div>

        {/* API not connected banner */}
        {!apiConnected && (
          <div style={{ background: '#fff8e1', borderBottom: '1px solid #fbbf24', padding: '10px 16px' }}>
            <p style={{ fontSize: '11px', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
              ⚠️ WhatsApp API not connected. Messages will be logged but not sent until you add your Meta credentials to Vercel environment variables.
            </p>
          </div>
        )}

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>💬</p>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#555', marginBottom: '4px' }}>No conversations yet</p>
              <p style={{ fontSize: '12px' }}>Start a new chat or wait for incoming messages</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div key={conv.phone} onClick={() => setSelectedPhone(conv.phone)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                  borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                  background: selectedPhone === conv.phone ? '#f0fdf4' : '#fff',
                  borderLeft: selectedPhone === conv.phone ? '3px solid #0F6E56' : '3px solid transparent',
                }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#0F6E5620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#0F6E56', flexShrink: 0 }}>
                  {conv.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.name}</p>
                    <p style={{ fontSize: '11px', color: '#aaa', margin: 0, flexShrink: 0 }}>{formatTime(conv.last_time)}</p>
                  </div>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.last_message}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0F6E56', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#aaa' }}>
            <span style={{ fontSize: '48px' }}>💬</span>
            <p style={{ fontSize: '16px', fontWeight: 600, color: '#555' }}>Select a conversation</p>
            <p style={{ fontSize: '13px' }}>Or start a new chat with a customer</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ padding: '14px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0F6E5620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700, color: '#0F6E56' }}>
                {selectedConv.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '15px', color: '#111', margin: 0 }}>{selectedConv.name}</p>
                <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>{selectedConv.phone}</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowTemplates(!showTemplates)}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#555' }}>
                  📋 Templates
                </button>
              </div>
            </div>

            {/* Templates panel */}
            {showTemplates && (
              <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 20px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#555', marginBottom: '8px', textTransform: 'uppercase' }}>Quick Templates</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {templates.map(tpl => (
                    <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                      style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #0F6E56', background: '#f0fdf4', color: '#0F6E56', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
           <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#e5ddd5' }}>
              {selectedConv.messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '65%', padding: '8px 12px', borderRadius: msg.direction === 'outbound' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: msg.direction === 'outbound' ? '#dcf8c6' : '#fff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                    {msg.template_name && (
                      <p style={{ fontSize: '10px', color: '#0F6E56', fontWeight: 600, margin: '0 0 4px' }}>📋 {msg.template_name}</p>
                    )}
                    <p style={{ fontSize: '13px', color: '#111', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.message_text}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                      <p style={{ fontSize: '10px', color: '#aaa', margin: 0 }}>{formatTime(msg.created_at)}</p>
                      {msg.direction === 'outbound' && (
                        <span style={{ fontSize: '10px', color: msg.status === 'read' ? '#53bdeb' : '#aaa' }}>
                          {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a message..."
                rows={2}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '24px', border: '1px solid #e5e7eb', fontSize: '14px', fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.4, background: '#f9fafb' }}
              />
              <button onClick={() => sendMessage()} disabled={!message.trim() || sending}
                style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: message.trim() && !sending ? '#0F6E56' : '#e5e7eb', color: '#fff', cursor: message.trim() && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bulk message modal */}
      {showBulk && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
          onClick={() => setShowBulk(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>📢 Bulk WhatsApp</h2>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>Send a message to all customers in a pipeline stage</p>

            {bulkResult ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>✅</p>
                <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>Bulk send complete</p>
                <p style={{ color: '#0F6E56', fontWeight: 600 }}>{bulkResult.sent} sent successfully</p>
                {bulkResult.failed > 0 && <p style={{ color: '#e24b4a' }}>{bulkResult.failed} failed</p>}
                <button onClick={() => { setShowBulk(false); setBulkResult(null) }}
                  style={{ marginTop: '16px', padding: '8px 24px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Pipeline Stage</label>
                  <select value={bulkStage} onChange={e => setBulkStage(e.target.value)} style={selectStyle}>
                    <option value="">Select a stage...</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({deals.filter(d => d.stage_id === s.id).length} contacts)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Message Template</label>
                  <select value={bulkTemplate} onChange={e => { setBulkTemplate(e.target.value); setBulkVars({}) }} style={selectStyle}>
                    <option value="">Select a template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {bulkTemplate && (() => {
                  const tpl = templates.find(t => t.id === bulkTemplate)
                  const vars = (tpl?.variables as string[] || []).filter(v => v !== 'name')
                  return vars.length > 0 ? (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={labelStyle}>Template Variables</label>
                      {vars.map(v => (
                        <div key={v} style={{ marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>{'{{'}{v}{'}}'}</label>
                          <input value={bulkVars[v] || ''} onChange={e => setBulkVars(prev => ({ ...prev, [v]: e.target.value }))}
                            placeholder={`Enter ${v}...`} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box' as const }} />
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}

                {bulkStage && bulkTemplate && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#0F6E56', fontWeight: 600, margin: '0 0 4px' }}>Ready to send</p>
                    <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
                      {deals.filter(d => d.stage_id === bulkStage && d.customer_phone).length} contacts with phone numbers will receive this message
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setShowBulk(false)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'transparent', color: '#666', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={sendBulk} disabled={!bulkStage || !bulkTemplate || bulkSending}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: bulkStage && bulkTemplate ? '#0F6E56' : '#e5e7eb', color: bulkStage && bulkTemplate ? '#fff' : '#aaa', fontWeight: 600, cursor: bulkStage && bulkTemplate ? 'pointer' : 'not-allowed' }}>
                    {bulkSending ? 'Sending...' : '📤 Send Bulk'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New chat modal */}
      {showNewChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}
          onClick={() => setShowNewChat(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '360px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>✏️ New Chat</h2>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Phone Number</label>
              <input value={newChatPhone} onChange={e => setNewChatPhone(e.target.value)}
                placeholder="07700 900000" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Name (optional)</label>
              <input value={newChatName} onChange={e => setNewChatName(e.target.value)}
                placeholder="Customer name" style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowNewChat(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'transparent', color: '#666', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={startNewChat} disabled={!newChatPhone.trim()}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: newChatPhone.trim() ? '#0F6E56' : '#e5e7eb', color: newChatPhone.trim() ? '#fff' : '#aaa', fontWeight: 600, cursor: newChatPhone.trim() ? 'pointer' : 'not-allowed' }}>
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }
const selectStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#fff', cursor: 'pointer' }