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
  { value: 'stage_change', label: 'Pipeline stage changes' },
  { value: 'quote_sent', label: 'Quote sent' },
  { value: 'booked', label: 'Job booked in diary' },
  { value: 'days_before_move', label: 'X days before moving date' },
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
  crm_deals?: { customer_name: string; customer_email: string }
  automation_sequences?: { name: string }
}

export default function AutomationsPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'builder' | 'log'>('list')
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null)

  // Builder state
  const [seqName, setSeqName] = useState('')
  const [triggerType, setTriggerType] = useState('stage_change')
  const [triggerConfig, setTriggerConfig] = useState<any>({})
  const [stopOnReply, setStopOnReply] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSequences()
    fetchEnrollments()
  }, [])

  async function fetchSequences() {
    setLoading(true)
    const { data } = await supabase
      .from('automation_sequences')
      .select('*, automation_steps(*)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
    setSequences(data || [])
    setLoading(false)
  }

  async function fetchEnrollments() {
    const { data } = await supabase
      .from('automation_enrollments')
      .select('*, crm_deals(customer_name, customer_email), automation_sequences(name)')
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(50)
    setEnrollments(data || [])
  }

  function openNewBuilder() {
    setEditingSequence(null)
    setSeqName('')
    setTriggerType('stage_change')
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
    setSteps(prev => [
      ...prev,
      {
        position: prev.length,
        step_type: 'send_email',
        delay_value: 1,
        delay_unit: 'hours',
        config: { subject: '', body: '' },
      },
    ])
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })))
  }

  function updateStep(index: number, updates: Partial<Step>) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

  function updateStepConfig(index: number, configUpdates: any) {
    setSteps(prev =>
      prev.map((s, i) => i === index ? { ...s, config: { ...s.config, ...configUpdates } } : s)
    )
  }

  async function saveSequence() {
    if (!seqName.trim()) return alert('Please enter a sequence name')
    if (steps.length === 0) return alert('Please add at least one step')
    setSaving(true)

    try {
      let sequenceId = editingSequence?.id

      if (editingSequence) {
        await supabase
          .from('automation_sequences')
          .update({
            name: seqName,
            trigger_type: triggerType,
            trigger_config: triggerConfig,
            stop_on_reply: stopOnReply,
          })
          .eq('id', sequenceId)

        await supabase
          .from('automation_steps')
          .delete()
          .eq('sequence_id', sequenceId)
      } else {
        const { data } = await supabase
          .from('automation_sequences')
          .insert({
            company_id: COMPANY_ID,
            name: seqName,
            trigger_type: triggerType,
            trigger_config: triggerConfig,
            stop_on_reply: stopOnReply,
            active: true,
          })
          .select()
          .single()
        sequenceId = data.id
      }

      const stepsToInsert = steps.map((s, i) => ({
        sequence_id: sequenceId,
        position: i,
        step_type: s.step_type,
        delay_value: s.delay_value,
        delay_unit: s.delay_unit,
        config: s.config,
      }))

      await supabase.from('automation_steps').insert(stepsToInsert)

      await fetchSequences()
      setView('list')
    } catch (err: any) {
      alert('Error saving: ' + err.message)
    }
    setSaving(false)
  }

  async function toggleActive(seq: Sequence) {
    await supabase
      .from('automation_sequences')
      .update({ active: !seq.active })
      .eq('id', seq.id)
    fetchSequences()
  }

  async function deleteSequence(id: string) {
    if (!confirm('Delete this sequence? All active enrollments will stop.')) return
    await supabase.from('automation_sequences').delete().eq('id', id)
    fetchSequences()
  }

  function getTriggerLabel(seq: Sequence) {
    switch (seq.trigger_type) {
      case 'stage_change':
        const stage = PIPELINE_STAGES.find(s => s.id === seq.trigger_config?.stage_id)
        return `Stage → ${stage?.name || 'any stage'}`
      case 'quote_sent': return 'Quote sent'
      case 'booked': return 'Job booked'
      case 'days_before_move':
        return `${seq.trigger_config?.days_before || 1} day(s) before move`
      default: return seq.trigger_type
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
            Automations
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Build email sequences triggered by deal activity
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {view !== 'list' && (
            <button onClick={() => setView('list')} style={secondaryBtn}>
              Back to list
            </button>
          )}
          {view === 'list' && (
            <>
              <button onClick={() => { fetchEnrollments(); setView('log') }} style={secondaryBtn}>
                Active enrollments
              </button>
              <button onClick={openNewBuilder} style={primaryBtn}>
                + New sequence
              </button>
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
                Create your first automation to start sending timed follow-ups automatically
              </p>
              <button onClick={openNewBuilder} style={primaryBtn}>+ New sequence</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sequences.map(seq => (
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
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        <span>Trigger: {getTriggerLabel(seq)}</span>
                        <span>{seq.automation_steps?.length || 0} step{(seq.automation_steps?.length || 0) !== 1 ? 's' : ''}</span>
                        <span>{seq.stop_on_reply ? 'Stops on reply' : 'Runs to completion'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => toggleActive(seq)} style={secondaryBtn}>
                        {seq.active ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={() => openEditBuilder(seq)} style={secondaryBtn}>
                        Edit
                      </button>
                      <button onClick={() => deleteSequence(seq.id)} style={dangerBtn}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUILDER VIEW */}
      {view === 'builder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Sequence name */}
          <div style={card}>
            <label style={labelStyle}>Sequence name</label>
            <input
              value={seqName}
              onChange={e => setSeqName(e.target.value)}
              placeholder="e.g. Post-quote follow up"
              style={inputStyle}
            />
          </div>

          {/* Trigger */}
          <div style={card}>
            <label style={labelStyle}>Trigger</label>
            <select
              value={triggerType}
              onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}) }}
              style={inputStyle}
            >
              {TRIGGER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {triggerType === 'stage_change' && (
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>When deal moves to stage</label>
                <select
                  value={triggerConfig.stage_id || ''}
                  onChange={e => setTriggerConfig({ stage_id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Any stage change</option>
                  {PIPELINE_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {triggerType === 'days_before_move' && (
              <div style={{ marginTop: '12px' }}>
                <label style={labelStyle}>Days before moving date</label>
                <input
                  type="number"
                  min={1}
                  value={triggerConfig.days_before || 1}
                  onChange={e => setTriggerConfig({ days_before: parseInt(e.target.value) })}
                  style={{ ...inputStyle, width: '100px' }}
                />
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="stop-on-reply"
                checked={stopOnReply}
                onChange={e => setStopOnReply(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
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
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Step {index + 1}
                    </span>
                    <button onClick={() => removeStep(index)} style={dangerBtn}>Remove</button>
                  </div>

                  {/* Delay */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Wait</label>
                      <input
                        type="number"
                        min={0}
                        value={step.delay_value}
                        onChange={e => updateStep(index, { delay_value: parseInt(e.target.value) || 0 })}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Unit</label>
                      <select
                        value={step.delay_unit}
                        onChange={e => updateStep(index, { delay_unit: e.target.value as 'hours' | 'days' })}
                        style={inputStyle}
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={labelStyle}>Then</label>
                      <select
                        value={step.step_type}
                        onChange={e => updateStep(index, {
                          step_type: e.target.value as 'send_email' | 'create_task',
                          config: {}
                        })}
                        style={inputStyle}
                      >
                        {STEP_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Email config */}
                  {step.step_type === 'send_email' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={labelStyle}>Subject</label>
                        <input
                          value={step.config.subject || ''}
                          onChange={e => updateStepConfig(index, { subject: e.target.value })}
                          placeholder="e.g. Following up on your quote"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Body</label>
                        <textarea
                          value={step.config.body || ''}
                          onChange={e => updateStepConfig(index, { body: e.target.value })}
                          placeholder={`Hi {name},\n\nJust wanted to follow up on your quote...\n\nVariables: {name} {moving_from} {moving_to} {moving_date}`}
                          rows={6}
                          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
                        Available variables: {'{name}'} {'{moving_from}'} {'{moving_to}'} {'{moving_date}'} {'{phone}'}
                      </p>
                    </div>
                  )}

                  {/* Task config */}
                  {step.step_type === 'create_task' && (
                    <div>
                      <label style={labelStyle}>Task title</label>
                      <input
                        value={step.config.task_title || ''}
                        onChange={e => updateStepConfig(index, { task_title: e.target.value })}
                        placeholder="e.g. Call {name} to confirm booking"
                        style={inputStyle}
                      />
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '6px 0 0' }}>
                        Available variables: {'{name}'} {'{moving_from}'} {'{moving_to}'} {'{moving_date}'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
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
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text-primary)' }}>
            Active enrollments
          </h2>
          {enrollments.length === 0 ? (
            <div style={emptyState}>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                No active enrollments right now
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {enrollments.map(e => (
                <div key={e.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {e.crm_deals?.customer_name || 'Unknown'}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginLeft: '10px' }}>
                        {e.crm_deals?.customer_email}
                      </span>
                    </div>
                    <span style={activeBadge}>Step {e.current_step + 1}</span>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', gap: '16px' }}>
                    <span>Sequence: {e.automation_sequences?.name}</span>
                    <span>Next send: {e.next_send_at ? new Date(e.next_send_at).toLocaleString('en-GB') : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Styles
const primaryBtn: React.CSSProperties = {
  background: '#0F6E56',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
}

const secondaryBtn: React.CSSProperties = {
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: '8px',
  padding: '8px 16px',
  fontSize: '13px',
  cursor: 'pointer',
}

const dangerBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#E24B4A',
  border: '1px solid #E24B4A',
  borderRadius: '8px',
  padding: '6px 12px',
  fontSize: '13px',
  cursor: 'pointer',
}

const card: React.CSSProperties = {
  background: 'var(--color-background-secondary)',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: '12px',
  padding: '18px',
}

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '48px 24px',
  background: 'var(--color-background-secondary)',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: '12px',
  color: 'var(--color-text-primary)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-border-tertiary)',
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '14px',
  boxSizing: 'border-box',
}

const activeBadge: React.CSSProperties = {
  background: '#E1F5EE',
  color: '#0F6E56',
  borderRadius: '20px',
  padding: '2px 10px',
  fontSize: '12px',
  fontWeight: 500,
}

const inactiveBadge: React.CSSProperties = {
  background: 'var(--color-background-secondary)',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-tertiary)',
  borderRadius: '20px',
  padding: '2px 10px',
  fontSize: '12px',
  fontWeight: 500,
}