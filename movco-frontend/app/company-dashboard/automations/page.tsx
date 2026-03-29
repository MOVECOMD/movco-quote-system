'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const COMPANY_ID = 'd83a643c-4f72-4df5-9618-7fe23db7bc01'

const PIPELINE_STAGES = [
  { id: '6a36fa88-8220-47b1-9f6d-98f63f630943', name: 'New Lead' },
  { id: '1fe63154-4ae2-4384-a62e-c65985571197', name: 'In Conversation' },
  { id: '8be5de73-12ca-4bec-924f-e50060ae5ddc', name: 'Contacted' },
  { id: '68cf884a-4330-41ea-b86c-6e7fc861d0ad', name: 'Appointment' },
  { id: '75d775ab-8670-44f3-a182-ca6411aaed42', name: 'Quote Sent' },
  { id: '79cc52aa-68bc-4297-bfbb-a23748621e32', name: 'Booked' },
]

const TRIGGER_TYPES = [
  { value: 'stage_change', label: 'Pipeline stage changes to' },
  { value: 'quote_sent', label: 'Quote is sent' },
  { value: 'booked', label: 'Job is booked in diary' },
  { value: 'days_before_move', label: 'X days before moving date' },
  { value: 'manual', label: 'Manual enrollment only' },
]

const STEP_TYPES = [
  { value: 'send_email', label: 'Send email' },
  { value: 'create_task', label: 'Create task reminder' },
]

type Step = {
  id?: string
  position: number
  step_type: 'send_email' | 'create_task'
  delay_value: number
  delay_unit: 'hours' | 'days'
  config: {
    subject?: string
    body?: string
    task_title?: string
  }
}

type Sequence = {
  id: string
  name: string
  trigger_type: string
  trigger_config: any
  stop_on_reply: boolean
  active: boolean
  created_at: string
  automation_steps?: Step[]
}

type Enrollment = {
  id: string
  sequence_id: string
  deal_id: string
  current_step: number
  next_send_at: string
  status: string
  enrolled_at: string
  crm_deals?: { customer_name: string; customer_email: string; moving_from: string | null; moving_to: string | null }
  automation_sequences?: { name: string }
}

type Deal = {
  id: string
  customer_name: string
  customer_email: string | null
  moving_from: string | null
  moving_to: string | null
  moving_date: string | null
  stage_id: string
  estimated_value: number | null
}

export default function AutomationsPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'builder' | 'log'>('list')
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null)

  // Builder state
  const [seqName, setSeqName] = useState('')
  const [triggerType, setTriggerType] = useState('manual')
  const [triggerConfig, setTriggerConfig] = useState<any>({})
  const [stopOnReply, setStopOnReply] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [saving, setSaving] = useState(false)

  // Enroll modal state
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollingSequence, setEnrollingSequence] = useState<Sequence | null>(null)
  const [dealSearch, setDealSearch] = useState('')
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)

  // Test modal state
  const [showTestModal, setShowTestModal] = useState(false)
  const [testingSequence, setTestingSequence] = useState<Sequence | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testName, setTestName] = useState('Test Customer')
  const [testing, setTesting] = useState(false)
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchSequences(), fetchEnrollments(), fetchDeals()])
    setLoading(false)
  }

  async function fetchSequences() {
    const { data } = await supabase
      .from('automation_sequences')
      .select('*, automation_steps(*)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
    setSequences(data || [])
  }

  async function fetchEnrollments() {
    const { data } = await supabase
      .from('automation_enrollments')
      .select('*, crm_deals(customer_name, customer_email, moving_from, moving_to), automation_sequences(name)')
      .in('status', ['active', 'completed', 'stopped'])
      .order('enrolled_at', { ascending: false })
      .limit(100)
    setEnrollments(data || [])
  }

  async function fetchDeals() {
    const { data } = await supabase
      .from('crm_deals')
      .select('id, customer_name, customer_email, moving_from, moving_to, moving_date, stage_id, estimated_value')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
    setDeals(data || [])
  }

  // ── BUILDER ──

  function openNewBuilder() {
    setEditingSequence(null)
    setSeqName('')
    setTriggerType('manual')
    setTriggerConfig({})
    setStopOnReply(false)
    setSteps([])
    setView('builder')
  }

  function openEditBuilder(seq: Sequence) {
    setEditingSequence(seq)
    setSeqName(seq.name)
    setTriggerType(seq.trigger_type)
    setTriggerConfig(seq.trigger_config || {})
    setStopOnReply(seq.stop_on_reply)
    const sorted = [...(seq.automation_steps || [])].sort((a, b) => a.position - b.position)
    setSteps(sorted)
    setView('builder')
  }

  function addStep() {
    setSteps(prev => [...prev, {
      position: prev.length,
      step_type: 'send_email',
      delay_value: 1,
      delay_unit: 'days',
      config: { subject: '', body: '' },
    }])
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })))
  }

  function updateStep(index: number, updates: Partial<Step>) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

  function updateStepConfig(index: number, configUpdates: any) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, config: { ...s.config, ...configUpdates } } : s))
  }

  async function saveSequence() {
    if (!seqName.trim()) return alert('Please enter a sequence name')
    if (steps.length === 0) return alert('Please add at least one step')
    setSaving(true)
    try {
      let sequenceId = editingSequence?.id
      if (editingSequence) {
        await supabase.from('automation_sequences').update({
          name: seqName, trigger_type: triggerType,
          trigger_config: triggerConfig, stop_on_reply: stopOnReply,
        }).eq('id', sequenceId)
        await supabase.from('automation_steps').delete().eq('sequence_id', sequenceId)
      } else {
        const { data, error } = await supabase.from('automation_sequences').insert({
          company_id: COMPANY_ID, name: seqName, trigger_type: triggerType,
          trigger_config: triggerConfig, stop_on_reply: stopOnReply, active: true,
        }).select().single()
        if (error) throw new Error('Insert failed: ' + JSON.stringify(error))
        if (!data) throw new Error('Insert returned no data')
        sequenceId = data.id
      }
      await supabase.from('automation_steps').insert(
        steps.map((s, i) => ({
          sequence_id: sequenceId, position: i, step_type: s.step_type,
          delay_value: s.delay_value, delay_unit: s.delay_unit, config: s.config,
        }))
      )
      await fetchSequences()
      setView('list')
    } catch (err: any) {
      alert('Error saving: ' + err.message)
    }
    setSaving(false)
  }

  async function toggleActive(seq: Sequence) {
    await supabase.from('automation_sequences').update({ active: !seq.active }).eq('id', seq.id)
    fetchSequences()
  }

  async function deleteSequence(id: string) {
    if (!confirm('Delete this sequence? All active enrollments will stop.')) return
    await supabase.from('automation_sequences').delete().eq('id', id)
    fetchSequences()
  }

  // ── ENROLL ──

  function openEnrollModal(seq: Sequence) {
    setEnrollingSequence(seq)
    setDealSearch('')
    setSelectedDealIds(new Set())
    setShowEnrollModal(true)
  }

  async function enrollDeals() {
    if (!enrollingSequence || selectedDealIds.size === 0) return
    setEnrolling(true)
    const steps = (enrollingSequence.automation_steps || []).sort((a, b) => a.position - b.position)
    const firstStep = steps[0]
    const delayMs = firstStep
      ? (firstStep.delay_unit === 'days'
        ? firstStep.delay_value * 24 * 60 * 60 * 1000
        : firstStep.delay_value * 60 * 60 * 1000)
      : 0
    const next_send_at = new Date(Date.now() + delayMs).toISOString()

    const toInsert = Array.from(selectedDealIds).map(deal_id => ({
      sequence_id: enrollingSequence.id,
      deal_id,
      current_step: 0,
      next_send_at,
      status: 'active',
    }))

    await supabase.from('automation_enrollments').insert(toInsert)
    await fetchEnrollments()
    setShowEnrollModal(false)
    setEnrollingSequence(null)
    alert(`${selectedDealIds.size} deal${selectedDealIds.size !== 1 ? 's' : ''} enrolled successfully`)
    setEnrolling(false)
  }

  async function stopEnrollment(enrollmentId: string) {
    if (!confirm('Stop this enrollment?')) return
    await supabase.from('automation_enrollments').update({ status: 'stopped' }).eq('id', enrollmentId)
    fetchEnrollments()
  }

  // ── TEST ──

  function openTestModal(seq: Sequence) {
    setTestingSequence(seq)
    setTestEmail('')
    setTestName('Test Customer')
    setTestSent(false)
    setShowTestModal(true)
  }

  async function sendTest() {
    if (!testingSequence || !testEmail) return
    const steps = (testingSequence.automation_steps || []).sort((a, b) => a.position - b.position)
    const firstStep = steps[0]
    if (!firstStep || firstStep.step_type !== 'send_email') {
      alert('First step is not an email — nothing to test')
      return
    }
    setTesting(true)
    try {
      const subject = interpolate(firstStep.config.subject || '', testName)
      const body = interpolate(firstStep.config.body || '', testName)
      const res = await fetch('/api/email/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: COMPANY_ID,
          recipient_email: testEmail,
          recipient_name: testName,
          subject: `[TEST] ${subject}`,
          body_text: body,
        }),
      })
      const data = await res.json()
      if (data.success || res.ok) {
        setTestSent(true)
      } else {
        alert('Failed to send test: ' + (data.error || 'Unknown error'))
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
    setTesting(false)
  }

  function interpolate(template: string, name: string): string {
    return template
      .replace(/\{name\}/g, name)
      .replace(/\{moving_from\}/g, '123 Old Street')
      .replace(/\{moving_to\}/g, '456 New Street')
      .replace(/\{moving_date\}/g, 'Saturday 5 April 2025')
      .replace(/\{phone\}/g, '07700 900000')
  }

  function getTriggerLabel(seq: Sequence) {
    switch (seq.trigger_type) {
      case 'stage_change':
        const stage = PIPELINE_STAGES.find(s => s.id === seq.trigger_config?.stage_id)
        return `Stage → ${stage?.name || 'any stage'}`
      case 'quote_sent': return 'Quote sent'
      case 'booked': return 'Job booked'
      case 'days_before_move': return `${seq.trigger_config?.days_before || 1} day(s) before move`
      case 'manual': return 'Manual enrollment'
      default: return seq.trigger_type
    }
  }

  const activeEnrollments = enrollments.filter(e => e.status === 'active')
  const filteredDeals = deals.filter(d =>
    d.customer_name.toLowerCase().includes(dealSearch.toLowerCase()) ||
    (d.customer_email || '').toLowerCase().includes(dealSearch.toLowerCase()) ||
    (d.moving_from || '').toLowerCase().includes(dealSearch.toLowerCase())
  )

  // ── RENDER ──

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
            Automations
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Build email sequences and manually enroll deals
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {view !== 'list' && (
            <button onClick={() => setView('list')} style={secondaryBtn}>Back to list</button>
          )}
          {view === 'list' && (
            <>
              <button onClick={() => { fetchEnrollments(); setView('log') }} style={secondaryBtn}>
                Enrollments {activeEnrollments.length > 0 && (
                  <span style={{ marginLeft: '6px', background: '#0F6E56', color: '#fff', borderRadius: '20px', padding: '1px 8px', fontSize: '11px' }}>
                    {activeEnrollments.length}
                  </span>
                )}
              </button>
              <button onClick={openNewBuilder} style={primaryBtn}>+ New sequence</button>
            </>
          )}
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <div>
          {loading ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
          ) : sequences.length === 0 ? (
            <div style={emptyState}>
              <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 8px' }}>No sequences yet</p>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
                Create a sequence, then manually enroll deals into it
              </p>
              <button onClick={openNewBuilder} style={primaryBtn}>+ New sequence</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sequences.map(seq => {
                const enrolledCount = enrollments.filter(e => e.sequence_id === seq.id && e.status === 'active').length
                const steps = (seq.automation_steps || []).sort((a, b) => a.position - b.position)
                return (
                  <div key={seq.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {seq.name}
                          </span>
                          <span style={seq.active ? activeBadge : inactiveBadge}>
                            {seq.active ? 'Active' : 'Paused'}
                          </span>
                          {enrolledCount > 0 && (
                            <span style={{ ...activeBadge, background: '#E6F1FB', color: '#185FA5' }}>
                              {enrolledCount} enrolled
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                          <span>Trigger: {getTriggerLabel(seq)}</span>
                          <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
                          <span>{seq.stop_on_reply ? 'Stops on reply' : 'Runs to completion'}</span>
                        </div>

                        {/* Step preview */}
                        {steps.length > 0 && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {steps.map((step, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#E1F5EE', color: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, flexShrink: 0 }}>
                                  {idx + 1}
                                </div>
                                <span>
                                  {step.delay_value > 0 ? `Wait ${step.delay_value} ${step.delay_unit}, then ` : ''}
                                  {step.step_type === 'send_email'
                                    ? `Send email: "${step.config.subject || 'No subject'}"`
                                    : `Create task: "${step.config.task_title || 'No title'}"`
                                  }
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, marginLeft: '16px' }}>
                        <button onClick={() => openTestModal(seq)} style={ghostBtn} title="Send test email">
                          Test
                        </button>
                        <button onClick={() => openEnrollModal(seq)} style={{ ...primaryBtn, padding: '6px 14px' }}>
                          Enroll deals
                        </button>
                        <button onClick={() => toggleActive(seq)} style={secondaryBtn}>
                          {seq.active ? 'Pause' : 'Activate'}
                        </button>
                        <button onClick={() => openEditBuilder(seq)} style={secondaryBtn}>Edit</button>
                        <button onClick={() => deleteSequence(seq.id)} style={dangerBtn}>Delete</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* BUILDER VIEW */}
      {view === 'builder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={card}>
            <label style={labelStyle}>Sequence name</label>
            <input
              value={seqName}
              onChange={e => setSeqName(e.target.value)}
              placeholder="e.g. Post-quote follow up"
              style={inputStyle}
            />
          </div>

          <div style={card}>
            <label style={labelStyle}>Trigger</label>
            <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}) }} style={inputStyle}>
              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              {triggerType === 'manual'
                ? 'Deals are enrolled manually from the sequence list — you choose exactly who gets this.'
                : 'This trigger will auto-enroll matching deals when the condition is met.'}
            </p>

            {triggerType === 'stage_change' && (
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>When deal moves to stage</label>
                <select value={triggerConfig.stage_id || ''} onChange={e => setTriggerConfig({ stage_id: e.target.value })} style={inputStyle}>
                  <option value="">Any stage change</option>
                  {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {triggerType === 'days_before_move' && (
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>Days before moving date</label>
                <input type="number" min={1} value={triggerConfig.days_before || 1}
                  onChange={e => setTriggerConfig({ days_before: parseInt(e.target.value) })}
                  style={{ ...inputStyle, width: '100px' }} />
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" id="stop-on-reply" checked={stopOnReply}
                onChange={e => setStopOnReply(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="stop-on-reply" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                Stop sequence if customer replies to any email
              </label>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Steps</label>
              <button onClick={addStep} style={secondaryBtn}>+ Add step</button>
            </div>

            {steps.length === 0 && (
              <div style={{ ...emptyState, padding: '24px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  No steps yet — add your first step above
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {steps.map((step, index) => (
                <div key={index} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Step {index + 1}</span>
                    <button onClick={() => removeStep(index)} style={dangerBtn}>Remove</button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Wait</label>
                      <input type="number" min={0} value={step.delay_value}
                        onChange={e => updateStep(index, { delay_value: parseInt(e.target.value) || 0 })}
                        style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Unit</label>
                      <select value={step.delay_unit} onChange={e => updateStep(index, { delay_unit: e.target.value as 'hours' | 'days' })} style={inputStyle}>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Then</label>
                      <select value={step.step_type}
                        onChange={e => updateStep(index, { step_type: e.target.value as 'send_email' | 'create_task', config: {} })}
                        style={inputStyle}>
                        {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {step.step_type === 'send_email' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={labelStyle}>Subject</label>
                        <input value={step.config.subject || ''} onChange={e => updateStepConfig(index, { subject: e.target.value })}
                          placeholder="e.g. Following up on your quote" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Body</label>
                        <textarea value={step.config.body || ''} onChange={e => updateStepConfig(index, { body: e.target.value })}
                          placeholder={`Hi {name},\n\nJust wanted to follow up...\n\nAvailable variables: {name} {moving_from} {moving_to} {moving_date}`}
                          rows={6} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Variables: {'{name}'} {'{moving_from}'} {'{moving_to}'} {'{moving_date}'} {'{phone}'}
                      </p>
                    </div>
                  )}

                  {step.step_type === 'create_task' && (
                    <div>
                      <label style={labelStyle}>Task title</label>
                      <input value={step.config.task_title || ''} onChange={e => updateStepConfig(index, { task_title: e.target.value })}
                        placeholder="e.g. Call {name} to confirm booking" style={inputStyle} />
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
                        Variables: {'{name}'} {'{moving_from}'} {'{moving_to}'} {'{moving_date}'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setView('list')} style={secondaryBtn}>Cancel</button>
            <button onClick={saveSequence} disabled={saving} style={primaryBtn}>
              {saving ? 'Saving...' : editingSequence ? 'Save changes' : 'Create sequence'}
            </button>
          </div>
        </div>
      )}

      {/* ENROLLMENT LOG VIEW */}
      {view === 'log' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['active', 'completed', 'stopped'].map(status => {
              const count = enrollments.filter(e => e.status === status).length
              return (
                <span key={status} style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                  background: status === 'active' ? '#E1F5EE' : 'var(--color-background-secondary)',
                  color: status === 'active' ? '#0F6E56' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-tertiary)'
                }}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
                </span>
              )
            })}
          </div>

          {enrollments.length === 0 ? (
            <div style={emptyState}>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                No enrollments yet — go to a sequence and click "Enroll deals"
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {enrollments.map(e => (
                <div key={e.id} style={{ ...card, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {e.crm_deals?.customer_name || 'Unknown'}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                          background: e.status === 'active' ? '#E1F5EE' : e.status === 'completed' ? '#E6F1FB' : 'var(--color-background-secondary)',
                          color: e.status === 'active' ? '#0F6E56' : e.status === 'completed' ? '#185FA5' : 'var(--color-text-secondary)',
                        }}>
                          {e.status}
                        </span>
                        {e.status === 'active' && (
                          <span style={{ ...activeBadge }}>Step {e.current_step + 1}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>Sequence: {e.automation_sequences?.name}</span>
                        {e.crm_deals?.customer_email && <span>{e.crm_deals.customer_email}</span>}
                        {e.status === 'active' && e.next_send_at && (
                          <span>Next: {new Date(e.next_send_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        <span>Enrolled: {new Date(e.enrolled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    {e.status === 'active' && (
                      <button onClick={() => stopEnrollment(e.id)} style={dangerBtn}>Stop</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ENROLL MODAL */}
      {showEnrollModal && enrollingSequence && (
        <div style={modalOverlay} onClick={() => setShowEnrollModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
                  Enroll deals
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                  Into: {enrollingSequence.name}
                </p>
              </div>
              <button onClick={() => setShowEnrollModal(false)} style={ghostBtn}>✕</button>
            </div>

            <input
              value={dealSearch}
              onChange={e => setDealSearch(e.target.value)}
              placeholder="Search deals by name, email or address..."
              style={{ ...inputStyle, marginBottom: '12px' }}
            />

            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {filteredDeals.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px', padding: '24px' }}>No deals found</p>
              ) : filteredDeals.map(deal => {
                const alreadyEnrolled = enrollments.some(e => e.deal_id === deal.id && e.sequence_id === enrollingSequence.id && e.status === 'active')
                const isSelected = selectedDealIds.has(deal.id)
                return (
                  <div
                    key={deal.id}
                    onClick={() => {
                      if (alreadyEnrolled) return
                      setSelectedDealIds(prev => {
                        const next = new Set(prev)
                        next.has(deal.id) ? next.delete(deal.id) : next.add(deal.id)
                        return next
                      })
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                      borderRadius: '8px', border: '1px solid var(--color-border-tertiary)',
                      background: isSelected ? '#E1F5EE' : alreadyEnrolled ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
                      cursor: alreadyEnrolled ? 'not-allowed' : 'pointer',
                      opacity: alreadyEnrolled ? 0.6 : 1,
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px', border: '2px solid',
                      borderColor: isSelected ? '#0F6E56' : 'var(--color-border-secondary)',
                      background: isSelected ? '#0F6E56' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: '11px', lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {deal.customer_name}
                        {alreadyEnrolled && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#0F6E56', fontWeight: 400 }}>Already enrolled</span>}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {deal.customer_email || 'No email'}{deal.moving_from ? ` · ${deal.moving_from}` : ''}
                      </p>
                    </div>
                    {deal.estimated_value && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F6E56' }}>£{deal.estimated_value.toLocaleString()}</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {selectedDealIds.size} deal{selectedDealIds.size !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowEnrollModal(false)} style={secondaryBtn}>Cancel</button>
                <button onClick={enrollDeals} disabled={selectedDealIds.size === 0 || enrolling} style={primaryBtn}>
                  {enrolling ? 'Enrolling...' : `Enroll ${selectedDealIds.size > 0 ? selectedDealIds.size : ''} deal${selectedDealIds.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST MODAL */}
      {showTestModal && testingSequence && (
        <div style={modalOverlay} onClick={() => setShowTestModal(false)}>
          <div style={{ ...modalBox, maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            {testSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  ✓
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-primary)' }}>Test sent!</h2>
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
                  Check {testEmail} for the test email
                </p>
                <button onClick={() => setShowTestModal(false)} style={primaryBtn}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>Test sequence</h2>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                      Sends step 1 to your email with sample data
                    </p>
                  </div>
                  <button onClick={() => setShowTestModal(false)} style={ghostBtn}>✕</button>
                </div>

                {(() => {
                  const steps = (testingSequence.automation_steps || []).sort((a, b) => a.position - b.position)
                  const firstStep = steps[0]
                  if (!firstStep || firstStep.step_type !== 'send_email') {
                    return (
                      <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          Step 1 is not an email — only email steps can be tested
                        </p>
                      </div>
                    )
                  }
                  return (
                    <div style={{ background: 'var(--color-background-secondary)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Step 1 preview</p>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        Subject: {firstStep.config.subject || 'No subject'}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'pre-line' }}>
                        {(firstStep.config.body || '').slice(0, 120)}{(firstStep.config.body || '').length > 120 ? '...' : ''}
                      </p>
                    </div>
                  )
                })()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Send test to</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Sample customer name</label>
                    <input
                      value={testName}
                      onChange={e => setTestName(e.target.value)}
                      placeholder="Test Customer"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowTestModal(false)} style={secondaryBtn}>Cancel</button>
                  <button onClick={sendTest} disabled={!testEmail || testing} style={primaryBtn}>
                    {testing ? 'Sending...' : 'Send test email'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ──

const primaryBtn: React.CSSProperties = {
  background: '#0F6E56', color: '#fff', border: 'none', borderRadius: '8px',
  padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-tertiary)', borderRadius: '8px',
  padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-tertiary)', borderRadius: '8px',
  padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
}

const dangerBtn: React.CSSProperties = {
  background: 'transparent', color: '#E24B4A', border: '1px solid #E24B4A',
  borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer',
}

const card: React.CSSProperties = {
  background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)',
  borderRadius: '12px', padding: '18px',
}

const emptyState: React.CSSProperties = {
  textAlign: 'center', padding: '48px 24px',
  background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-tertiary)',
  borderRadius: '12px', color: 'var(--color-text-primary)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 500,
  color: 'var(--color-text-secondary)', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '1px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)', fontSize: '14px', boxSizing: 'border-box',
}

const activeBadge: React.CSSProperties = {
  background: '#E1F5EE', color: '#0F6E56', borderRadius: '20px',
  padding: '2px 10px', fontSize: '12px', fontWeight: 500,
}

const inactiveBadge: React.CSSProperties = {
  background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-tertiary)', borderRadius: '20px',
  padding: '2px 10px', fontSize: '12px', fontWeight: 500,
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '16px',
}

const modalBox: React.CSSProperties = {
  background: 'var(--color-background-primary)', borderRadius: '16px',
  padding: '24px', width: '100%', maxWidth: '600px',
  maxHeight: '85vh', overflowY: 'auto',
  border: '1px solid var(--color-border-tertiary)',
}
