'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AiAssistant from '@/components/AiAssistant'
import { useAuth } from '@/context/AuthContext'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)



const TRIGGER_TYPES = [
  { type: 'stage_change', label: 'Deal moves to stage', icon: '🔀', description: 'When a deal enters a specific pipeline stage' },
  { type: 'new_deal', label: 'New deal created', icon: '🆕', description: 'When any new deal is added to the pipeline' },
  { type: 'quote_sent', label: 'Quote sent', icon: '📤', description: 'When a quote is sent to a customer' },
  { type: 'quote_accepted', label: 'Quote accepted', icon: '✅', description: 'When a customer accepts a quote' },
  { type: 'quote_declined', label: 'Quote declined', icon: '❌', description: 'When a customer declines a quote' },
  { type: 'no_response', label: 'No response', icon: '⏰', description: 'When no activity on a deal for X days' },
  { type: 'days_before_move', label: 'Days before move', icon: '📅', description: 'X days before the moving date' },
  { type: 'manual', label: 'Manual trigger', icon: '👆', description: 'Manually enroll deals from the pipeline' },
]

const STEP_TYPES = [
  { type: 'send_email', label: 'Send Email', icon: '📧', color: '#0F6E56' },
  { type: 'send_sms', label: 'Send SMS', icon: '💬', color: '#3b82f6' },
  { type: 'send_whatsapp', label: 'Send WhatsApp', icon: '📱', color: '#25d366' },
  { type: 'create_task', label: 'Create Task', icon: '✅', color: '#f59e0b' },
  { type: 'move_deal', label: 'Move Deal', icon: '🔀', color: '#8b5cf6' },
  { type: 'notify', label: 'Notify Team', icon: '🔔', color: '#ef4444' },
  { type: 'add_note', label: 'Add Note', icon: '📝', color: '#6b7280' },
  { type: 'condition', label: 'Condition (If/Else)', icon: '🔀', color: '#ec4899' },
  { type: 'wait_for_reply', label: 'Wait for Reply', icon: '⏳', color: '#14b8a6' },
  { type: 'delay', label: 'Wait / Delay', icon: '⏱️', color: '#a855f7' },
]

type Step = {
  id?: string
  step_type: string
  config: any
  delay_value: number
  delay_unit: string
  position: number
  condition_config?: any
}

type Sequence = {
  id?: string
  name: string
  description: string
  trigger_type: string
  trigger_config: any
  active: boolean
  steps: Step[]
  enrollment_count?: number
  last_triggered_at?: string
}

export default function AutomationsPage() {
  const { companyId: COMPANY_ID } = useAuth()
  const [sequences, setSequences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Sequence | null>(null)
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [stages, setStages] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [enrollments, setEnrollments] = useState<any[]>([])

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [seqRes, stagesRes, enrollRes] = await Promise.all([
      fetch(`/api/automations/list?company_id=${COMPANY_ID}`).then(r => r.json()).catch(() => ({ sequences: [] })),
      supabase.from('crm_pipeline_stages').select('*').eq('company_id', COMPANY_ID).order('position'),
      supabase.from('automation_enrollments').select('*, automation_sequences(name)').eq('status', 'active').limit(20),
    ])
    setSequences(seqRes.sequences || [])
    setStages(stagesRes.data || [])
    setEnrollments(enrollRes.data || [])
    setLoading(false)
  }

  function newSequence() {
    setEditing({
      name: '',
      description: '',
      trigger_type: 'stage_change',
      trigger_config: {},
      active: true,
      steps: [],
    })
    setEditingStep(null)
  }

  function editSequence(seq: any) {
    setEditing({
      id: seq.id,
      name: seq.name,
      description: seq.description || '',
      trigger_type: seq.trigger_type,
      trigger_config: seq.trigger_config || {},
      active: seq.active,
      steps: (seq.automation_steps || []).sort((a: any, b: any) => a.position - b.position).map((s: any) => ({
        id: s.id,
        step_type: s.step_type,
        config: s.config || {},
        delay_value: s.delay_value || 0,
        delay_unit: s.delay_unit || 'hours',
        position: s.position,
        condition_config: s.condition_config || {},
      })),
    })
    setEditingStep(null)
  }

  function addStep(type: string) {
    if (!editing) return
    const newStep: Step = {
      step_type: type,
      config: {},
      delay_value: type === 'delay' ? 1 : 0,
      delay_unit: 'hours',
      position: editing.steps.length,
      condition_config: type === 'condition' ? { field: 'estimated_value', operator: 'greater_than', value: '500' } : {},
    }
    setEditing({ ...editing, steps: [...editing.steps, newStep] })
    setEditingStep(editing.steps.length)
  }

  function removeStep(idx: number) {
    if (!editing) return
    const steps = editing.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i }))
    setEditing({ ...editing, steps })
    setEditingStep(null)
  }

  function moveStep(idx: number, dir: 'up' | 'down') {
    if (!editing) return
    const steps = [...editing.steps]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= steps.length) return
    ;[steps[idx], steps[target]] = [steps[target], steps[idx]]
    steps.forEach((s, i) => s.position = i)
    setEditing({ ...editing, steps })
    setEditingStep(target)
  }

  function updateStep(idx: number, updates: Partial<Step>) {
    if (!editing) return
    const steps = editing.steps.map((s, i) => i === idx ? { ...s, ...updates } : s)
    setEditing({ ...editing, steps })
  }

  async function saveSequence() {
    if (!editing || !editing.name.trim()) return alert('Please enter a sequence name')
    setSaving(true)

    try {
      const res = await fetch('/api/automations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: COMPANY_ID, sequence: editing }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await fetchAll()
      setEditing(null)
    } catch (err: any) {
      alert('Save failed: ' + err.message)
    }
    setSaving(false)
  }

  async function deleteSequence(id: string) {
    if (!confirm('Delete this automation? This cannot be undone.')) return
    await fetch('/api/automations/save', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: id }),
    })
    await fetchAll()
  }

  async function toggleActive(seq: any) {
    await fetch('/api/automations/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence_id: seq.id, active: !seq.active }),
    })
    await fetchAll()
  }

  // ── LIST VIEW ──
  if (!editing) {
    return (
      <div style={{ padding: '28px', minHeight: '100vh', background: '#f8f9fa', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0a0f1c', margin: 0 }}>Automations</h1>
            <p style={{ color: '#666', margin: '4px 0 0', fontSize: '0.9rem' }}>
              Build automated workflows that trigger on events and run sequences of actions
            </p>
          </div>
          <button onClick={newSequence} style={primaryBtn}>+ New Automation</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total Automations', value: sequences.length, color: '#0F6E56' },
            { label: 'Active', value: sequences.filter((s: any) => s.active).length, color: '#22c55e' },
            { label: 'Currently Running', value: enrollments.length, color: '#3b82f6' },
            { label: 'Paused', value: sequences.filter((s: any) => !s.active).length, color: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #eee' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>Loading automations...</div>
        ) : sequences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', background: '#fff', borderRadius: '16px', border: '1px solid #eee' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚡</div>
            <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#0a0f1c' }}>No automations yet</h3>
            <p style={{ color: '#888', margin: '0 0 24px', fontSize: '0.9rem' }}>Create your first automation to save time and follow up with customers automatically</p>
            <button onClick={newSequence} style={primaryBtn}>+ Create Your First Automation</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sequences.map((seq: any) => {
              const trigger = TRIGGER_TYPES.find(t => t.type === seq.trigger_type)
              const stepCount = seq.automation_steps?.length || 0
              return (
                <div key={seq.id} style={{
                  background: '#fff', borderRadius: '12px', border: '1px solid #eee', padding: '20px',
                  display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.15s',
                }} onClick={() => editSequence(seq)}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    background: seq.active ? '#E1F5EE' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0,
                  }}>
                    {trigger?.icon || '⚡'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0a0f1c' }}>{seq.name}</h3>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600,
                        background: seq.active ? '#dcfce7' : '#fef3c7',
                        color: seq.active ? '#166534' : '#92400e',
                      }}>{seq.active ? 'Active' : 'Paused'}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#888' }}>
                      {trigger?.label} → {stepCount} step{stepCount !== 1 ? 's' : ''}
                      {seq.enrollment_count > 0 && ` · ${seq.enrollment_count} enrolled`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); toggleActive(seq) }} style={smallBtn}>
                      {seq.active ? '⏸ Pause' : '▶ Activate'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteSequence(seq.id) }} style={{ ...smallBtn, color: '#ef4444', borderColor: '#fecaca' }}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <AiAssistant />
      </div>
    )
  }

  // ── VISUAL BUILDER ──
  const currentStepData = editingStep !== null ? editing.steps[editingStep] : null
  const trigger = TRIGGER_TYPES.find(t => t.type === editing.trigger_type)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8f9fa', fontFamily: 'system-ui, sans-serif' }}>

      {/* Left — Flow Canvas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Header */}
        <div style={{ width: '100%', maxWidth: '500px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <button onClick={() => setEditing(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ← Back
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setEditing({ ...editing, active: !editing.active })} style={{
              ...smallBtn,
              background: editing.active ? '#dcfce7' : '#fef3c7',
              color: editing.active ? '#166534' : '#92400e',
              border: 'none',
            }}>
              {editing.active ? '● Active' : '○ Paused'}
            </button>
            <button onClick={saveSequence} disabled={saving} style={primaryBtn}>
              {saving ? 'Saving...' : '💾 Save Automation'}
            </button>
          </div>
        </div>

        {/* Sequence Name */}
        <div style={{ width: '100%', maxWidth: '500px', marginBottom: '28px' }}>
          <input
            value={editing.name}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            placeholder="Automation name..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e5e7eb',
              fontSize: '1.1rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <input
            value={editing.description}
            onChange={e => setEditing({ ...editing, description: e.target.value })}
            placeholder="Description (optional)..."
            style={{
              width: '100%', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb',
              fontSize: '0.85rem', outline: 'none', marginTop: '8px', color: '#666', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Trigger Node */}
        <div
          onClick={() => setEditingStep(-1)}
          style={{
            width: '100%', maxWidth: '400px', background: '#fff', borderRadius: '14px',
            border: editingStep === -1 ? '2px solid #0F6E56' : '2px solid #e5e7eb',
            padding: '20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
            boxShadow: editingStep === -1 ? '0 4px 20px rgba(15,110,86,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>⚡</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Trigger</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0a0f1c' }}>{trigger?.label || 'Select trigger'}</div>
        </div>

        {/* Connector */}
        <div style={{ width: '2px', height: '24px', background: '#d1d5db' }} />

        {/* Steps */}
        {editing.steps.map((step, idx) => {
          const stepType = STEP_TYPES.find(t => t.type === step.step_type)
          const isSelected = editingStep === idx

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
              {/* Delay label */}
              {(step.delay_value > 0 || step.step_type === 'delay') && (
                <div style={{
                  background: '#f3f4f6', borderRadius: '20px', padding: '4px 14px',
                  fontSize: '0.75rem', color: '#666', fontWeight: 600, marginBottom: '8px',
                }}>
                  ⏱ Wait {step.delay_value} {step.delay_unit}
                </div>
              )}

              {/* Step Node */}
              <div
                onClick={() => setEditingStep(idx)}
                style={{
                  width: '100%', background: '#fff', borderRadius: '14px',
                  border: isSelected ? `2px solid ${stepType?.color || '#0F6E56'}` : '2px solid #e5e7eb',
                  padding: '16px 20px', cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: isSelected ? `0 4px 20px ${stepType?.color}25` : '0 2px 8px rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', gap: '14px',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                  background: `${stepType?.color || '#888'}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  {stepType?.icon || '⚙️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0a0f1c' }}>{stepType?.label || step.step_type}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                    {getStepSummary(step)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); moveStep(idx, 'up') }} style={tinyBtn}>↑</button>
                  <button onClick={e => { e.stopPropagation(); moveStep(idx, 'down') }} style={tinyBtn}>↓</button>
                  <button onClick={e => { e.stopPropagation(); removeStep(idx) }} style={{ ...tinyBtn, color: '#ef4444' }}>✕</button>
                </div>
              </div>

              {/* Condition branches */}
              {step.step_type === 'condition' && (
                <div style={{ display: 'flex', gap: '40px', marginTop: '12px', width: '100%' }}>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#dcfce7', fontSize: '0.75rem', fontWeight: 600, color: '#166534' }}>
                    ✓ Yes → continue
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#fee2e2', fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>
                    ✗ No → skip next step
                  </div>
                </div>
              )}

              {/* Connector */}
              <div style={{ width: '2px', height: '24px', background: '#d1d5db' }} />
            </div>
          )
        })}

        {/* Add Step Button */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
          <AddStepMenu onAdd={addStep} />
        </div>

        {/* End node */}
        <div style={{ width: '2px', height: '24px', background: '#d1d5db' }} />
        <div style={{
          width: '100%', maxWidth: '400px', background: '#f3f4f6', borderRadius: '14px', border: '2px dashed #d1d5db',
          padding: '16px', textAlign: 'center', fontSize: '0.82rem', color: '#888', fontWeight: 600,
        }}>
          🏁 End of automation
        </div>

        <div style={{ height: '60px' }} />
      </div>

      {/* Right — Config Panel */}
      <div style={{
        width: '380px', flexShrink: 0, background: '#fff', borderLeft: '1px solid #e5e7eb',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {editingStep === -1 ? (
          <TriggerConfig
            sequence={editing}
            onChange={updates => setEditing({ ...editing, ...updates })}
            stages={stages}
          />
        ) : editingStep !== null && currentStepData ? (
          <StepConfig
            step={currentStepData}
            index={editingStep}
            onChange={updates => updateStep(editingStep, updates)}
            stages={stages}
          />
        ) : (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#aaa' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👆</div>
            <p style={{ fontSize: '0.9rem' }}>Click a trigger or step to configure it</p>
          </div>
        )}
      </div>

      <AiAssistant />
    </div>
  )
}

// ── ADD STEP MENU ──
function AddStepMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '12px', borderRadius: '12px', border: '2px dashed #0F6E56',
          background: open ? '#E1F5EE' : 'transparent', color: '#0F6E56', fontSize: '0.85rem',
          fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        + Add Step
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)', padding: '8px', marginTop: '8px',
        }}>
          {STEP_TYPES.map(st => (
            <button
              key={st.type}
              onClick={() => { onAdd(st.type); setOpen(false) }}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '8px', border: 'none',
                background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '12px', fontSize: '0.85rem', textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: '32px', height: '32px', borderRadius: '8px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: `${st.color}15`,
                fontSize: '1rem', flexShrink: 0,
              }}>
                {st.icon}
              </span>
              <div>
                <div style={{ fontWeight: 600, color: '#0a0f1c' }}>{st.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TRIGGER CONFIG ──
function TriggerConfig({ sequence, onChange, stages }: { sequence: any; onChange: (updates: any) => void; stages: any[] }) {
  return (
    <div style={{ padding: '24px' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: '#0a0f1c' }}>⚡ Configure Trigger</h3>

      <label style={labelStyle}>Trigger type</label>
      <select
        value={sequence.trigger_type}
        onChange={e => onChange({ trigger_type: e.target.value, trigger_config: {} })}
        style={selectStyle}
      >
        {TRIGGER_TYPES.map(t => (
          <option key={t.type} value={t.type}>{t.icon} {t.label}</option>
        ))}
      </select>

      <p style={{ fontSize: '0.8rem', color: '#888', margin: '8px 0 20px', lineHeight: 1.5 }}>
        {TRIGGER_TYPES.find(t => t.type === sequence.trigger_type)?.description}
      </p>

      {sequence.trigger_type === 'stage_change' && (
        <>
          <label style={labelStyle}>When deal moves to</label>
          <select
            value={sequence.trigger_config?.stage_id || ''}
            onChange={e => onChange({ trigger_config: { ...sequence.trigger_config, stage_id: e.target.value } })}
            style={selectStyle}
          >
            <option value="">Any stage</option>
            {stages.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </>
      )}

      {sequence.trigger_type === 'days_before_move' && (
        <>
          <label style={labelStyle}>Days before moving date</label>
          <input
            type="number"
            value={sequence.trigger_config?.days_before || 1}
            onChange={e => onChange({ trigger_config: { days_before: parseInt(e.target.value) || 1 } })}
            style={inputStyle}
            min={1}
          />
        </>
      )}

      {sequence.trigger_type === 'no_response' && (
        <>
          <label style={labelStyle}>Days without activity</label>
          <input
            type="number"
            value={sequence.trigger_config?.days_without_response || 3}
            onChange={e => onChange({ trigger_config: { ...sequence.trigger_config, days_without_response: parseInt(e.target.value) || 3 } })}
            style={inputStyle}
            min={1}
          />
          <label style={labelStyle}>In pipeline stage</label>
          <select
            value={sequence.trigger_config?.stage_id || ''}
            onChange={e => onChange({ trigger_config: { ...sequence.trigger_config, stage_id: e.target.value } })}
            style={selectStyle}
          >
            <option value="">Select stage</option>
            {stages.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}

// ── STEP CONFIG ──
function StepConfig({ step, index, onChange, stages }: { step: any; index: number; onChange: (updates: any) => void; stages: any[] }) {
  const stepType = STEP_TYPES.find(t => t.type === step.step_type)

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <span style={{
          width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: `${stepType?.color || '#888'}15`,
          fontSize: '1.1rem',
        }}>
          {stepType?.icon}
        </span>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0a0f1c' }}>Step {index + 1}: {stepType?.label}</h3>
        </div>
      </div>

      {/* Delay before this step */}
      <label style={labelStyle}>Delay before this step</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          type="number"
          value={step.delay_value}
          onChange={e => onChange({ delay_value: parseInt(e.target.value) || 0 })}
          style={{ ...inputStyle, flex: 1 }}
          min={0}
        />
        <select
          value={step.delay_unit}
          onChange={e => onChange({ delay_unit: e.target.value })}
          style={{ ...selectStyle, flex: 1 }}
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>

      {/* Type-specific config */}
      {(step.step_type === 'send_email') && (
        <>
          <label style={labelStyle}>Subject</label>
          <input
            value={step.config.subject || ''}
            onChange={e => onChange({ config: { ...step.config, subject: e.target.value } })}
            style={inputStyle}
            placeholder="Hi {name}, just following up..."
          />
          <label style={labelStyle}>Email body</label>
          <textarea
            value={step.config.body || ''}
            onChange={e => onChange({ config: { ...step.config, body: e.target.value } })}
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
            placeholder="Use {name}, {moving_from}, {moving_to}, {moving_date}, {value} for variables"
          />
          <p style={{ fontSize: '0.72rem', color: '#aaa', margin: '6px 0 0' }}>
            Variables: {'{name}'} {'{email}'} {'{phone}'} {'{moving_from}'} {'{moving_to}'} {'{moving_date}'} {'{value}'}
          </p>
        </>
      )}

      {(step.step_type === 'send_sms' || step.step_type === 'send_whatsapp') && (
        <>
          <label style={labelStyle}>Message</label>
          <textarea
            value={step.config.message || ''}
            onChange={e => onChange({ config: { ...step.config, message: e.target.value } })}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder="Hi {name}, just checking in about your move..."
          />
        </>
      )}

      {step.step_type === 'create_task' && (
        <>
          <label style={labelStyle}>Task title</label>
          <input
            value={step.config.task_title || ''}
            onChange={e => onChange({ config: { ...step.config, task_title: e.target.value } })}
            style={inputStyle}
            placeholder="Follow up with {name}"
          />
          <label style={labelStyle}>Due in (days)</label>
          <input
            type="number"
            value={step.config.due_in_days || 1}
            onChange={e => onChange({ config: { ...step.config, due_in_days: parseInt(e.target.value) || 1 } })}
            style={inputStyle}
            min={1}
          />
        </>
      )}

      {step.step_type === 'move_deal' && (
        <>
          <label style={labelStyle}>Move to stage</label>
          <select
            value={step.config.stage_id || ''}
            onChange={e => onChange({ config: { ...step.config, stage_id: e.target.value } })}
            style={selectStyle}
          >
            <option value="">Select stage</option>
            {stages.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </>
      )}

      {step.step_type === 'notify' && (
        <>
          <label style={labelStyle}>Notification message</label>
          <textarea
            value={step.config.message || ''}
            onChange={e => onChange({ config: { ...step.config, message: e.target.value } })}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder="{name} needs attention — no response for 3 days"
          />
        </>
      )}

      {step.step_type === 'add_note' && (
        <>
          <label style={labelStyle}>Note text</label>
          <textarea
            value={step.config.note_text || ''}
            onChange={e => onChange({ config: { ...step.config, note_text: e.target.value } })}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder="Automation: follow-up email sent to {name}"
          />
        </>
      )}

      {step.step_type === 'condition' && (
        <>
          <label style={labelStyle}>If this field...</label>
          <select
            value={step.condition_config?.field || 'estimated_value'}
            onChange={e => onChange({ condition_config: { ...step.condition_config, field: e.target.value } })}
            style={selectStyle}
          >
            <option value="estimated_value">Deal value</option>
            <option value="customer_email">Customer email</option>
            <option value="customer_phone">Customer phone</option>
            <option value="moving_from">Moving from</option>
            <option value="moving_to">Moving to</option>
            <option value="notes">Notes</option>
          </select>

          <label style={labelStyle}>...matches this condition</label>
          <select
            value={step.condition_config?.operator || 'greater_than'}
            onChange={e => onChange({ condition_config: { ...step.condition_config, operator: e.target.value } })}
            style={selectStyle}
          >
            <option value="greater_than">Greater than</option>
            <option value="less_than">Less than</option>
            <option value="equals">Equals</option>
            <option value="not_equals">Not equals</option>
            <option value="contains">Contains</option>
            <option value="not_empty">Is not empty</option>
            <option value="is_empty">Is empty</option>
          </select>

          {!['not_empty', 'is_empty'].includes(step.condition_config?.operator) && (
            <>
              <label style={labelStyle}>Value</label>
              <input
                value={step.condition_config?.value || ''}
                onChange={e => onChange({ condition_config: { ...step.condition_config, value: e.target.value } })}
                style={inputStyle}
                placeholder="500"
              />
            </>
          )}
        </>
      )}

      {step.step_type === 'wait_for_reply' && (
        <>
          <label style={labelStyle}>Timeout (hours)</label>
          <input
            type="number"
            value={step.config.timeout_hours || 48}
            onChange={e => onChange({ config: { ...step.config, timeout_hours: parseInt(e.target.value) || 48 } })}
            style={inputStyle}
            min={1}
          />
          <p style={{ fontSize: '0.8rem', color: '#888', margin: '8px 0 0', lineHeight: 1.5 }}>
            The sequence will pause here until the customer replies or the timeout expires. Then it continues to the next step.
          </p>
        </>
      )}
    </div>
  )
}

// ── HELPERS ──
function getStepSummary(step: Step): string {
  const c = step.config || {}
  switch (step.step_type) {
    case 'send_email': return c.subject ? `"${c.subject}"` : 'Configure email...'
    case 'send_sms': return c.message ? c.message.substring(0, 40) + '...' : 'Configure SMS...'
    case 'send_whatsapp': return c.message ? c.message.substring(0, 40) + '...' : 'Configure WhatsApp...'
    case 'create_task': return c.task_title || 'Configure task...'
    case 'move_deal': return c.stage_id ? 'Move to stage' : 'Select stage...'
    case 'notify': return c.message ? c.message.substring(0, 40) + '...' : 'Configure notification...'
    case 'add_note': return c.note_text ? c.note_text.substring(0, 40) + '...' : 'Configure note...'
    case 'condition': return step.condition_config?.field ? `If ${step.condition_config.field} ${step.condition_config.operator} ${step.condition_config.value || ''}` : 'Configure condition...'
    case 'wait_for_reply': return `Wait up to ${c.timeout_hours || 48}h`
    case 'delay': return `Wait ${step.delay_value} ${step.delay_unit}`
    default: return 'Configure...'
  }
}

// ── STYLES ──
const primaryBtn: React.CSSProperties = {
  background: '#0F6E56', color: '#fff', border: 'none', borderRadius: '10px',
  padding: '10px 20px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
}
const smallBtn: React.CSSProperties = {
  background: '#fff', color: '#333', border: '1px solid #e5e7eb', borderRadius: '8px',
  padding: '6px 14px', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
}
const tinyBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem',
  color: '#888', padding: '4px', borderRadius: '4px',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#555',
  marginBottom: '6px', marginTop: '16px', textTransform: 'uppercase', letterSpacing: '0.3px',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
  fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  background: '#fff',
}
