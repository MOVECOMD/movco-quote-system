'use client'

import { useState } from 'react'

interface DayPlanModalProps {
  deal: any
  onClose: () => void
}

export default function DayPlanModal({ deal, onClose }: DayPlanModalProps) {
  const [loading, setLoading] = useState(false)
  const [aiPlan, setAiPlan] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [crewCount, setCrewCount] = useState(deal.crew_count || deal.quote_data?.crew_count || '')
  const [vanCount, setVanCount] = useState(deal.van_count || deal.quote_data?.van_count || '')
  const [notes, setNotes] = useState(deal.notes || '')
  const [generated, setGenerated] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/day-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id })
      })
      const data = await res.json()
      setAiPlan(data.ai_plan)
      setGenerated(true)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const exportPdf = async () => {
    setPdfLoading(true)
    try {
      const res = await fetch('/api/day-plan/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal, ai_plan: aiPlan, start_time: startTime, crew_count: crewCount, van_count: vanCount, notes })
      })
      const { html } = await res.json()

      // Open in new window and trigger print
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        setTimeout(() => win.print(), 500)
      }
    } catch (e) {
      console.error(e)
    }
    setPdfLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">🚛 Day Plan</h2>
            <p className="text-sm text-gray-500 mt-0.5">{deal.title || deal.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">

          {/* Job details row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Crew Count</label>
              <input
                type="number"
                value={crewCount}
                onChange={e => setCrewCount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="e.g. 3"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Van Count</label>
              <input
                type="number"
                value={vanCount}
                onChange={e => setVanCount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="e.g. 2"
              />
            </div>
          </div>

          {/* Generate button */}
          {!generated && (
            <button
              onClick={generate}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-60"
            >
              {loading ? '✨ Generating plan...' : '✨ Generate Day Plan with AI'}
            </button>
          )}

          {/* AI Plan output — editable */}
          {generated && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                AI Day Plan <span className="text-gray-400 font-normal normal-case">(edit as needed)</span>
              </label>
              <textarea
                value={aiPlan}
                onChange={e => setAiPlan(e.target.value)}
                rows={12}
                className="w-full border rounded-lg px-3 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Additional Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Parking info, access codes, special instructions..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Regenerate + Export */}
          {generated && (
            <div className="flex gap-3">
              <button
                onClick={generate}
                disabled={loading}
                className="flex-1 border border-orange-500 text-orange-500 hover:bg-orange-50 font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-60"
              >
                {loading ? 'Regenerating...' : '↺ Regenerate'}
              </button>
              <button
                onClick={exportPdf}
                disabled={pdfLoading}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-60"
              >
                {pdfLoading ? 'Preparing...' : '⬇ Export PDF'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}