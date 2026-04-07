'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { getAvailableTemplates } from '@/lib/templateSeeds'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TEMPLATES = getAvailableTemplates().map(t => ({
  type: t.key,
  label: t.label,
  emoji: getTemplateEmoji(t.key),
  desc: getTemplateDesc(t.key),
}))

function getTemplateEmoji(key: string): string {
  const map: Record<string, string> = {
    removals: '🚛', plumber: '🔧', electrician: '⚡', builder: '🏗️', painter: '🎨',
    roofer: '🏠', locksmith: '🔐', gardener: '🌿', pest_control: '🐀', flooring: '🪵',
    window_cleaner: '🪟', handyman: '🛠️', hvac: '❄️', estate_agent: '🏡', letting_agent: '🔑',
    cleaning: '🧹', vet: '🐾', dental: '🦷', salon: '💇', barber: '💈',
    personal_trainer: '💪', photographer: '📸', wedding_planner: '💒', dog_groomer: '🐕',
    dog_walker: '🦮', driving_instructor: '🚗', tutor: '📚', accountant: '📊',
    solicitor: '⚖️', catering: '🍽️', tattoo: '🎨', mechanic: '🔩', retail: '🛍️',
    physio: '🏥', skip_hire: '🗑️', security: '📹', it_support: '💻', funeral_director: '🕊️',
    default: '🏢',
  }
  return map[key] || '🏢'
}

function getTemplateDesc(key: string): string {
  const map: Record<string, string> = {
    removals: 'Quotes, pipeline, diary & leads',
    plumber: 'Jobs, callouts & certificates',
    electrician: 'Jobs, testing & certification',
    builder: 'Projects, quotes & scheduling',
    painter: 'Jobs, quotes & scheduling',
    roofer: 'Jobs, inspections & quotes',
    locksmith: 'Emergency calls & jobs',
    gardener: 'Maintenance rounds & quotes',
    pest_control: 'Surveys, treatments & follow-ups',
    flooring: 'Measures, fittings & orders',
    window_cleaner: 'Rounds, scheduling & clients',
    handyman: 'Jobs, quotes & invoicing',
    hvac: 'Installations, servicing & quotes',
    estate_agent: 'Properties, viewings & offers',
    letting_agent: 'Lettings, tenants & inspections',
    cleaning: 'Recurring jobs & scheduling',
    vet: 'Patients, appointments & billing',
    dental: 'Patients, treatments & recalls',
    salon: 'Bookings, clients & services',
    barber: 'Appointments & walk-ins',
    personal_trainer: 'Clients, sessions & packages',
    photographer: 'Shoots, bookings & galleries',
    wedding_planner: 'Weddings, suppliers & planning',
    dog_groomer: 'Appointments & client dogs',
    dog_walker: 'Walks, schedules & clients',
    driving_instructor: 'Lessons, students & test dates',
    tutor: 'Students, lessons & progress',
    accountant: 'Clients, deadlines & returns',
    solicitor: 'Matters, clients & deadlines',
    catering: 'Events, menus & bookings',
    tattoo: 'Consultations, sessions & designs',
    mechanic: 'Diagnostics, repairs & servicing',
    retail: 'Orders, customers & fulfilment',
    physio: 'Patients, treatments & sessions',
    skip_hire: 'Deliveries, collections & hires',
    security: 'Surveys, installations & monitoring',
    it_support: 'Support tickets, projects & clients',
    funeral_director: 'Arrangements, services & aftercare',
    default: 'Leads, pipeline & scheduling',
  }
  return map[key] || 'Leads, pipeline & scheduling'
}

type Message = {
  id: string
  role: 'assistant' | 'user'
  content: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'template' | 'chat' | 'done'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCompany()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function getCompany() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/signup'); return }
    const { data } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
    if (data) setCompanyId(data.id)
  }

  async function selectTemplate(type: string) {
    setSelectedTemplate(type)
    setStep('chat')

    // Update company template type
    if (companyId) {
      await supabase.from('companies').update({ template_type: type }).eq('id', companyId)
    }

    // Start AI onboarding chat
    const template = TEMPLATES.find(t => t.type === type)
    const welcomeMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Great choice! I'm going to set up your ${template?.label} management system. I just need a few quick details to configure everything perfectly for you.\n\nFirst — what areas or postcodes do you cover? This helps me set up your lead coverage zones.`,
    }
    setMessages([welcomeMsg])
  }

  async function sendMessage() {
    const content = input.trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const template = TEMPLATES.find(t => t.type === selectedTemplate)
      const res = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          onboarding: true,
          template_type: selectedTemplate,
          template_label: template?.label,
        }),
      })
      const data = await res.json()

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
      }
      setMessages(prev => [...prev, assistantMsg])

       // Check if onboarding is complete
      if (data.onboarding_complete) {
        await supabase.from('companies').update({
          onboarding_complete: true,
          onboarding_data: data.onboarding_data || {},
        }).eq('id', companyId)

        // Seed CRM with template stages and email templates
        await fetch('/api/seed-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            company_id: companyId,
            template_type: selectedTemplate,
          }),
        })

        setTimeout(() => {
          setStep('done')
          setTimeout(() => router.push('/company-dashboard'), 2000)
        }, 1000)
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

  if (step === 'done') return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, system-ui, sans-serif', background: '#F9FAFB', flexDirection: 'column', gap: '16px',
    }}>
      <div style={{
        width: '56px', height: '56px', background: '#0F6E56', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <h2 style={{ fontSize: '22px', fontWeight: '500', color: '#0e1117' }}>You're all set!</h2>
      <p style={{ fontSize: '14px', color: '#6B7280' }}>Taking you to your dashboard...</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#F9FAFB',
      fontFamily: 'DM Sans, system-ui, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB',
        padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '28px', height: '28px', background: '#0F6E56', borderRadius: '7px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#0e1117' }}>buildyourmanagement</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: step === 'template' ? '#0F6E56' : '#E5E7EB',
          }}/>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: step === 'chat' ? '#0F6E56' : '#E5E7EB',
          }}/>
        </div>
      </div>

      {/* Template picker */}
      {step === 'template' && (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '500', color: '#0e1117', marginBottom: '8px' }}>
              What type of business are you?
            </h1>
            <p style={{ fontSize: '15px', color: '#6B7280', fontWeight: '300' }}>
              We'll load the right template and configure everything for your industry.
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px',
          }}>
            {TEMPLATES.map(t => (
              <button
                key={t.type}
                onClick={() => selectTemplate(t.type)}
                style={{
                  background: '#fff', border: '1px solid #E5E7EB',
                  borderRadius: '12px', padding: '20px 16px', cursor: 'pointer',
                  textAlign: 'center', transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#0F6E56'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{t.emoji}</div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#0e1117', marginBottom: '4px' }}>
                  {t.label}
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '300' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Chat onboarding */}
      {step === 'chat' && (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>
              {TEMPLATES.find(t => t.type === selectedTemplate)?.emoji}
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '500', color: '#0e1117', marginBottom: '4px' }}>
              Setting up your {TEMPLATES.find(t => t.type === selectedTemplate)?.label} system
            </h2>
            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Answer a few questions and we'll configure everything</p>
          </div>

          {/* Chat */}
          <div style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px',
            overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>

            {/* Header */}
            <div style={{
              background: '#0F6E56', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>Setup assistant</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Configuring your system</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
              minHeight: '320px', maxHeight: '400px', overflowY: 'auto', background: '#F9FAFB',
            }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '85%', padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: msg.role === 'user' ? '#0F6E56' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#111827',
                    fontSize: '13px', lineHeight: '1.5',
                    border: msg.role === 'assistant' ? '1px solid #E5E7EB' : 'none',
                    whiteSpace: 'pre-line',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px 16px 16px 4px', width: 'fit-content' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#0F6E56',
                      animation: 'bounce 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                    }}/>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 16px', borderTop: '1px solid #E5E7EB', background: '#fff',
              display: 'flex', gap: '8px', alignItems: 'flex-end',
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }}}
                placeholder="Type your answer..."
                rows={2}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '10px',
                  border: '1px solid #E5E7EB', fontSize: '13px',
                  fontFamily: 'inherit', resize: 'none', outline: 'none',
                  color: '#111827', background: '#F9FAFB', lineHeight: '1.4',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                  background: input.trim() && !loading ? '#0F6E56' : '#E5E7EB',
                  color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9CA3AF', marginTop: '16px' }}>
            Enter to send · This usually takes 2-3 minutes
          </p>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}