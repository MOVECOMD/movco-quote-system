'use client'

import { useState, useMemo } from 'react'

// ============================================
// TYPES
// ============================================

type WidgetType =
  | 'revenue_month' | 'pipeline_value' | 'total_customers' | 'quote_conversion'
  | 'deals_count' | 'avg_deal_value' | 'overdue_tasks' | 'upcoming_jobs'
  | 'source_breakdown' | 'pipeline_funnel' | 'monthly_revenue' | 'tag_analytics'
  | 'quote_win_rate' | 'busiest_days' | 'customer_ltv' | 'cost_breakdown'
  | 'pnl_summary' | 'job_profitability' | 'revenue_by_stage' | 'lead_response'
  | 'recent_activity' | 'source_revenue' | 'monthly_customers' | 'stage_duration'

type WidgetSize = 'sm' | 'md' | 'lg' | 'xl'

interface WidgetConfig {
  id: string
  type: WidgetType
  size: WidgetSize
}

interface WidgetDef {
  type: WidgetType
  label: string
  icon: string
  description: string
  defaultSize: WidgetSize
  category: string
}

// ============================================
// WIDGET CATALOG
// ============================================

const WIDGET_CATALOG: WidgetDef[] = [
  // Stat cards
  { type: 'revenue_month', label: 'Revenue This Month', icon: '💰', description: 'Total revenue from completed jobs this month', defaultSize: 'sm', category: 'Revenue' },
  { type: 'pipeline_value', label: 'Pipeline Value', icon: '📊', description: 'Total value of all deals in pipeline', defaultSize: 'sm', category: 'Pipeline' },
  { type: 'total_customers', label: 'Total Contacts', icon: '👥', description: 'Number of contacts in your CRM', defaultSize: 'sm', category: 'Customers' },
  { type: 'quote_conversion', label: 'Quote Conversion', icon: '🎯', description: 'Percentage of quotes accepted', defaultSize: 'sm', category: 'Quotes' },
  { type: 'deals_count', label: 'Active Deals', icon: '🤝', description: 'Number of deals in your pipeline', defaultSize: 'sm', category: 'Pipeline' },
  { type: 'avg_deal_value', label: 'Average Deal Value', icon: '📈', description: 'Average value across all deals', defaultSize: 'sm', category: 'Pipeline' },
  { type: 'overdue_tasks', label: 'Overdue Tasks', icon: '⚠️', description: 'Tasks past their due date', defaultSize: 'sm', category: 'Tasks' },
  { type: 'upcoming_jobs', label: 'Upcoming This Week', icon: '📅', description: 'Jobs scheduled for the next 7 days', defaultSize: 'sm', category: 'Events' },

  // Charts & breakdowns
  { type: 'source_breakdown', label: 'Contacts by Source', icon: '📣', description: 'Where your contacts come from', defaultSize: 'md', category: 'Marketing' },
  { type: 'source_revenue', label: 'Revenue by Source', icon: '💷', description: 'Revenue attributed to each source', defaultSize: 'md', category: 'Marketing' },
  { type: 'pipeline_funnel', label: 'Pipeline Funnel', icon: '🔄', description: 'Conversion through pipeline stages', defaultSize: 'md', category: 'Pipeline' },
  { type: 'monthly_revenue', label: 'Monthly Revenue Trend', icon: '📉', description: 'Revenue over the last 6 months', defaultSize: 'lg', category: 'Revenue' },
  { type: 'monthly_customers', label: 'New Contacts Trend', icon: '📈', description: 'New contacts added per month', defaultSize: 'md', category: 'Marketing' },
  { type: 'tag_analytics', label: 'Tag Breakdown', icon: '🏷️', description: 'Contacts and revenue by tag', defaultSize: 'md', category: 'Customers' },
  { type: 'quote_win_rate', label: 'Quote Win Rate', icon: '✅', description: 'Quote outcomes breakdown', defaultSize: 'md', category: 'Quotes' },
  { type: 'busiest_days', label: 'Busiest Days', icon: '🗓️', description: 'Which days have the most bookings', defaultSize: 'md', category: 'Events' },
  { type: 'customer_ltv', label: 'Top Customers', icon: '⭐', description: 'Highest value customers', defaultSize: 'md', category: 'Customers' },
  { type: 'cost_breakdown', label: 'Cost Breakdown', icon: '💸', description: 'Expenses by category', defaultSize: 'md', category: 'Costs' },
  { type: 'pnl_summary', label: 'Profit & Loss', icon: '📋', description: 'Revenue vs costs summary', defaultSize: 'md', category: 'Revenue' },
  { type: 'job_profitability', label: 'Job Profitability', icon: '🏆', description: 'Profit margin per completed job', defaultSize: 'xl', category: 'Revenue' },
  { type: 'revenue_by_stage', label: 'Value by Stage', icon: '📶', description: 'Deal values grouped by pipeline stage', defaultSize: 'md', category: 'Pipeline' },
  { type: 'lead_response', label: 'Lead Age', icon: '⏱️', description: 'How long contacts sit in first stage', defaultSize: 'md', category: 'Pipeline' },
  { type: 'recent_activity', label: 'Recent Activity', icon: '🔔', description: 'Latest notes, tasks and events', defaultSize: 'md', category: 'Activity' },
  { type: 'stage_duration', label: 'Stage Duration', icon: '⏳', description: 'Average time deals spend in each stage', defaultSize: 'md', category: 'Pipeline' },
]

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: '1', type: 'revenue_month', size: 'sm' },
  { id: '2', type: 'pipeline_value', size: 'sm' },
  { id: '3', type: 'total_customers', size: 'sm' },
  { id: '4', type: 'quote_conversion', size: 'sm' },
  { id: '5', type: 'source_breakdown', size: 'md' },
  { id: '6', type: 'pipeline_funnel', size: 'md' },
  { id: '7', type: 'monthly_revenue', size: 'lg' },
  { id: '8', type: 'tag_analytics', size: 'md' },
  { id: '9', type: 'quote_win_rate', size: 'md' },
  { id: '10', type: 'cost_breakdown', size: 'md' },
  { id: '11', type: 'pnl_summary', size: 'md' },
  { id: '12', type: 'customer_ltv', size: 'md' },
]

const CATEGORIES = [...new Set(WIDGET_CATALOG.map(w => w.category))]

// ============================================
// HELPER: period filter
// ============================================

type Period = 'week' | 'month' | 'lastmonth' | 'quarter' | 'year' | 'all'

function filterByPeriod(dateStr: string, period: Period): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  if (period === 'all') return true
  if (period === 'week') { const w = new Date(now); w.setDate(w.getDate() - 7); return d >= w }
  if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (period === 'lastmonth') { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear() }
  if (period === 'quarter') { const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); return d >= qStart }
  if (period === 'year') return d.getFullYear() === now.getFullYear()
  return true
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReportsDashboard({ leads, deals, customers, events, crmQuotes, company, costs, onAddCost, onUpdateCost, onDeleteCost }: {
  leads: any[]; deals: any[]; customers: any[]; events: any[]; crmQuotes: any[]; company: any;
  costs: any[];
  onAddCost: (cost: any) => Promise<any>;
  onUpdateCost: (costId: string, fields: any) => void;
  onDeleteCost: (costId: string) => void;
}) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [period, setPeriod] = useState<Period>('month')
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [addCategory, setAddCategory] = useState('All')
  const [editing, setEditing] = useState(false)

  // Pre-compute all data for widgets
  const data = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    // Revenue
    const completedJobs = events.filter((e: any) => e.completed && e.event_type === 'job')
    const completedJobsMonth = completedJobs.filter((e: any) => { const d = new Date(e.start_time); return d.getMonth() === thisMonth && d.getFullYear() === thisYear })
    const completedDealIds = new Set(completedJobs.map((e: any) => e.deal_id).filter(Boolean))
    const completedDealIdsMonth = new Set(completedJobsMonth.map((e: any) => e.deal_id).filter(Boolean))
    const revenueMonth = deals.filter((d: any) => completedDealIdsMonth.has(d.id)).reduce((s: number, d: any) => s + (d.estimated_value || 0), 0)
    const pipelineValue = deals.reduce((s: number, d: any) => s + (d.estimated_value || 0), 0)
    const avgDealValue = deals.length > 0 ? Math.round(pipelineValue / deals.length) : 0

    // Tasks
    const overdueTasks = (customers as any).__tasks?.filter((t: any) => !t.completed && new Date(t.due_date) < now) || []
    const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7)
    const upcomingJobs = events.filter((e: any) => { if (e.event_type !== 'job' || e.completed) return false; const d = new Date(e.start_time); return d >= now && d <= weekEnd })

    // Quotes
    const acceptedQuotes = crmQuotes.filter((q: any) => q.status === 'accepted')
    const declinedQuotes = crmQuotes.filter((q: any) => q.status === 'declined')
    const sentQuotes = crmQuotes.filter((q: any) => q.status === 'sent')
    const draftQuotes = crmQuotes.filter((q: any) => q.status === 'draft')
    const conversionRate = crmQuotes.length > 0 ? Math.round((acceptedQuotes.length / crmQuotes.length) * 100) : 0

    // Source breakdown
    const sourceMap: Record<string, { count: number; revenue: number }> = {}
    customers.forEach((c: any) => {
      const src = c.source || 'Unknown'
      if (!sourceMap[src]) sourceMap[src] = { count: 0, revenue: 0 }
      sourceMap[src].count++
      // Find linked deals for revenue
      const customerDeals = deals.filter((d: any) => d.customer_id === c.id || d.customer_name?.toLowerCase() === c.name?.toLowerCase())
      customerDeals.forEach((d: any) => { if (d.estimated_value) sourceMap[src].revenue += d.estimated_value })
    })
    const sources = Object.entries(sourceMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count)

    // Tag breakdown
    const tagMap: Record<string, { count: number; revenue: number }> = {}
    customers.forEach((c: any) => {
      const tags: string[] = c.tags || []
      tags.forEach((tag: string) => {
        if (!tagMap[tag]) tagMap[tag] = { count: 0, revenue: 0 }
        tagMap[tag].count++
        const customerDeals = deals.filter((d: any) => d.customer_id === c.id || d.customer_name?.toLowerCase() === c.name?.toLowerCase())
        customerDeals.forEach((d: any) => { if (d.estimated_value) tagMap[tag].revenue += d.estimated_value })
      })
    })
    const tags = Object.entries(tagMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count)

    // Pipeline funnel
    const stages = [...new Set(deals.map((d: any) => d.stage_id))].map(stageId => {
      const stageDeals = deals.filter((d: any) => d.stage_id === stageId)
      return { stageId, name: stageId, count: stageDeals.length, value: stageDeals.reduce((s: number, d: any) => s + (d.estimated_value || 0), 0) }
    })

    // Monthly revenue (last 6 months)
    const monthlyRevenue: { month: string; revenue: number; deals: number; shortMonth: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = new Date(thisYear, thisMonth - i, 1)
      const mDeals = deals.filter((d: any) => {
        const completedEvents = events.filter((e: any) => e.deal_id === d.id && e.completed && e.event_type === 'job')
        return completedEvents.some((e: any) => { const ed = new Date(e.start_time); return ed.getMonth() === m.getMonth() && ed.getFullYear() === m.getFullYear() })
      })
      monthlyRevenue.push({
        month: m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        shortMonth: m.toLocaleDateString('en-GB', { month: 'short' }),
        revenue: mDeals.reduce((s: number, d: any) => s + (d.estimated_value || 0), 0),
        deals: mDeals.length,
      })
    }

    // Monthly new customers
    const monthlyCustomers: { month: string; count: number; shortMonth: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = new Date(thisYear, thisMonth - i, 1)
      const count = customers.filter((c: any) => { const d = new Date(c.created_at); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear() }).length
      monthlyCustomers.push({ month: m.toLocaleDateString('en-GB', { month: 'long' }), shortMonth: m.toLocaleDateString('en-GB', { month: 'short' }), count })
    }

    // Busiest days
    const dayMap: Record<string, number> = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }
    events.filter((e: any) => e.event_type === 'job').forEach((e: any) => {
      const day = new Date(e.start_time).toLocaleDateString('en-GB', { weekday: 'long' })
      if (dayMap[day] !== undefined) dayMap[day]++
    })
    const busiestDays = Object.entries(dayMap).map(([day, count]) => ({ day, count }))

    // Customer LTV
    const customerLtv = customers.map((c: any) => {
      const customerDeals = deals.filter((d: any) => d.customer_id === c.id || d.customer_name?.toLowerCase() === c.name?.toLowerCase())
      const totalValue = customerDeals.reduce((s: number, d: any) => s + (d.estimated_value || 0), 0)
      const jobCount = events.filter((e: any) => e.completed && customerDeals.some((d: any) => d.id === e.deal_id)).length
      return { name: c.name, email: c.email, totalValue, jobCount, dealCount: customerDeals.length }
    }).filter(c => c.totalValue > 0).sort((a, b) => b.totalValue - a.totalValue)

    // Cost breakdown
    const costMap: Record<string, number> = {}
    costs.forEach((c: any) => {
      const cat = c.category || 'other'
      costMap[cat] = (costMap[cat] || 0) + Number(c.amount)
    })
    const costBreakdown = Object.entries(costMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
    const totalCosts = costs.reduce((s: number, c: any) => s + Number(c.amount), 0)
    const totalRevenue = deals.filter((d: any) => completedDealIds.has(d.id)).reduce((s: number, d: any) => s + (d.estimated_value || 0), 0)

    // Job profitability
    const jobProfit = deals.filter((d: any) => completedDealIds.has(d.id)).map((d: any) => {
      const dealCosts = costs.filter((c: any) => c.deal_id === d.id).reduce((s: number, c: any) => s + Number(c.amount), 0)
      const quote = crmQuotes.find((q: any) => q.deal_id === d.id)
      const revenue = quote?.estimated_price || d.estimated_value || 0
      return { name: d.customer_name, revenue, costs: dealCosts, profit: revenue - dealCosts, margin: revenue > 0 ? ((revenue - dealCosts) / revenue * 100) : 0, date: d.moving_date }
    }).sort((a, b) => b.revenue - a.revenue)

    // Lead age (days in first stage)
    const leadAge = deals.slice(0, 20).map((d: any) => {
      const created = new Date(d.created_at)
      const days = Math.floor((now.getTime() - created.getTime()) / 86400000)
      return { name: d.customer_name, days, created: d.created_at }
    })

    return {
      revenueMonth, pipelineValue, avgDealValue, conversionRate,
      totalCustomers: customers.length, totalDeals: deals.length,
      overdueTasks: overdueTasks.length, upcomingJobs: upcomingJobs.length,
      sources, tags, stages, monthlyRevenue, monthlyCustomers,
      busiestDays, customerLtv, costBreakdown, totalCosts, totalRevenue,
      jobProfit, leadAge,
      acceptedQuotes: acceptedQuotes.length, declinedQuotes: declinedQuotes.length,
      sentQuotes: sentQuotes.length, draftQuotes: draftQuotes.length,
      totalQuotes: crmQuotes.length,
    }
  }, [leads, deals, customers, events, crmQuotes, costs])

  const addWidget = (type: WidgetType) => {
    const def = WIDGET_CATALOG.find(w => w.type === type)
    if (!def) return
    setWidgets(prev => [...prev, { id: Date.now().toString(), type, size: def.defaultSize }])
    setShowAddWidget(false)
  }

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id))
  }

  const moveWidget = (id: string, dir: 'up' | 'down') => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id)
      if (idx === -1) return prev
      const target = dir === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const resizeWidget = (id: string) => {
    const sizes: WidgetSize[] = ['sm', 'md', 'lg', 'xl']
    setWidgets(prev => prev.map(w => {
      if (w.id !== id) return w
      const idx = sizes.indexOf(w.size)
      return { ...w, size: sizes[(idx + 1) % sizes.length] }
    }))
  }

  const activeTypes = new Set(widgets.map(w => w.type))
  const availableWidgets = WIDGET_CATALOG.filter(w => !activeTypes.has(w.type))
  const filteredAvailable = addCategory === 'All' ? availableWidgets : availableWidgets.filter(w => w.category === addCategory)

  const sizeClasses: Record<WidgetSize, string> = {
    sm: 'col-span-1',
    md: 'col-span-1 md:col-span-2',
    lg: 'col-span-1 md:col-span-3',
    xl: 'col-span-1 md:col-span-4',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Customise your dashboard with the widgets you need</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'quarter', label: 'Quarter' },
              { key: 'year', label: 'Year' },
              { key: 'all', label: 'All' },
            ] as { key: Period; label: string }[]).map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${period === p.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setEditing(!editing)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition ${editing ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {editing ? '✓ Done' : '⚙️ Customise'}
          </button>
          <button onClick={() => setShowAddWidget(true)}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
            + Add Widget
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {widgets.map(widget => {
          const def = WIDGET_CATALOG.find(w => w.type === widget.type)
          if (!def) return null
          return (
            <div key={widget.id} className={`${sizeClasses[widget.size]} bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-all relative group`}>
              {/* Edit controls */}
              {editing && (
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => moveWidget(widget.id, 'up')} className="w-6 h-6 bg-white shadow rounded flex items-center justify-center text-gray-400 hover:text-gray-700 text-xs">↑</button>
                  <button onClick={() => moveWidget(widget.id, 'down')} className="w-6 h-6 bg-white shadow rounded flex items-center justify-center text-gray-400 hover:text-gray-700 text-xs">↓</button>
                  <button onClick={() => resizeWidget(widget.id)} className="w-6 h-6 bg-white shadow rounded flex items-center justify-center text-gray-400 hover:text-blue-600 text-xs" title="Resize">⇔</button>
                  <button onClick={() => removeWidget(widget.id)} className="w-6 h-6 bg-white shadow rounded flex items-center justify-center text-gray-400 hover:text-red-500 text-xs">✕</button>
                </div>
              )}
              <Widget type={widget.type} data={data} period={period} />
            </div>
          )
        })}
      </div>

      {widgets.length === 0 && (
        <div className="bg-white rounded-xl border p-16 text-center">
          <p className="text-lg font-bold text-gray-800 mb-2">No widgets added</p>
          <p className="text-sm text-gray-500 mb-4">Click "Add Widget" to build your custom dashboard</p>
          <button onClick={() => setShowAddWidget(true)} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">+ Add Widget</button>
        </div>
      )}

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddWidget(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add Widget</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{availableWidgets.length} available</p>
                </div>
                <button onClick={() => setShowAddWidget(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                <button onClick={() => setAddCategory('All')} className={`px-3 py-1 rounded-full text-xs font-medium transition ${addCategory === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setAddCategory(cat)} className={`px-3 py-1 rounded-full text-xs font-medium transition ${addCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{cat}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAvailable.length === 0 ? (
                <p className="text-center text-gray-400 py-8">All widgets in this category are already added</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredAvailable.map(w => (
                    <button key={w.type} onClick={() => addWidget(w.type)}
                      className="text-left p-4 rounded-xl border-2 border-gray-100 hover:border-blue-400 hover:bg-blue-50 transition">
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <span className="text-lg">{w.icon}</span>
                        <span className="text-sm font-semibold text-gray-900">{w.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{w.description}</p>
                      <span className="text-[10px] text-gray-400 mt-1.5 inline-block bg-gray-100 px-2 py-0.5 rounded">{w.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => { setWidgets(DEFAULT_WIDGETS); setShowAddWidget(false) }} className="text-xs text-blue-600 font-medium hover:text-blue-800">Reset to defaults</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// WIDGET RENDERER
// ============================================

function Widget({ type, data, period }: { type: WidgetType; data: any; period: Period }) {
  switch (type) {
    case 'revenue_month': return <StatCard icon="💰" label="Revenue This Month" value={`£${data.revenueMonth.toLocaleString()}`} color="green" />
    case 'pipeline_value': return <StatCard icon="📊" label="Pipeline Value" value={`£${data.pipelineValue.toLocaleString()}`} color="blue" />
    case 'total_customers': return <StatCard icon="👥" label="Total Contacts" value={data.totalCustomers.toLocaleString()} color="indigo" />
    case 'quote_conversion': return <StatCard icon="🎯" label="Quote Conversion" value={`${data.conversionRate}%`} subtitle={`${data.acceptedQuotes} of ${data.totalQuotes} accepted`} color="purple" />
    case 'deals_count': return <StatCard icon="🤝" label="Active Deals" value={data.totalDeals.toLocaleString()} color="orange" />
    case 'avg_deal_value': return <StatCard icon="📈" label="Avg Deal Value" value={`£${data.avgDealValue.toLocaleString()}`} color="teal" />
    case 'overdue_tasks': return <StatCard icon="⚠️" label="Overdue Tasks" value={data.overdueTasks.toString()} color={data.overdueTasks > 0 ? 'red' : 'green'} />
    case 'upcoming_jobs': return <StatCard icon="📅" label="This Week" value={data.upcomingJobs.toString()} subtitle="upcoming jobs" color="blue" />

    case 'source_breakdown': return <SourceBreakdown sources={data.sources} />
    case 'source_revenue': return <SourceRevenue sources={data.sources} />
    case 'pipeline_funnel': return <PipelineFunnel stages={data.stages} />
    case 'monthly_revenue': return <MonthlyRevenue data={data.monthlyRevenue} />
    case 'monthly_customers': return <MonthlyCustomers data={data.monthlyCustomers} />
    case 'tag_analytics': return <TagAnalytics tags={data.tags} />
    case 'quote_win_rate': return <QuoteWinRate accepted={data.acceptedQuotes} declined={data.declinedQuotes} sent={data.sentQuotes} draft={data.draftQuotes} total={data.totalQuotes} />
    case 'busiest_days': return <BusiestDays days={data.busiestDays} />
    case 'customer_ltv': return <CustomerLtv customers={data.customerLtv} />
    case 'cost_breakdown': return <CostBreakdown costs={data.costBreakdown} total={data.totalCosts} />
    case 'pnl_summary': return <PnlSummary revenue={data.totalRevenue} costs={data.totalCosts} />
    case 'job_profitability': return <JobProfitability jobs={data.jobProfit} />
    case 'revenue_by_stage': return <RevenueByStage stages={data.stages} />
    case 'lead_response': return <LeadAge leads={data.leadAge} />
    case 'recent_activity': return <RecentActivity />
    case 'stage_duration': return <StageDuration stages={data.stages} />
    default: return <div className="p-5 text-sm text-gray-400">Unknown widget</div>
  }
}

// ============================================
// WIDGET COMPONENTS
// ============================================

function StatCard({ icon, label, value, subtitle, color }: { icon: string; label: string; value: string; subtitle?: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-600', blue: 'text-blue-600', indigo: 'text-indigo-600', purple: 'text-purple-600',
    orange: 'text-orange-600', teal: 'text-teal-600', red: 'text-red-600',
  }
  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colors[color] || 'text-gray-900'}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

function BarChart({ items, maxValue, valueKey, labelKey, colorFn, formatValue }: { items: any[]; maxValue: number; valueKey: string; labelKey: string; colorFn?: (item: any, idx: number) => string; formatValue?: (v: number) => string }) {
  const fmt = formatValue || ((v: number) => v.toString())
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 font-medium w-24 truncate text-right">{item[labelKey]}</span>
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max((item[valueKey] / (maxValue || 1)) * 100, item[valueKey] > 0 ? 4 : 0)}%`, background: colorFn ? colorFn(item, i) : '#3b82f6' }} />
          </div>
          <span className="text-xs font-bold text-gray-700 w-16 text-right">{fmt(item[valueKey])}</span>
        </div>
      ))}
    </div>
  )
}

function SourceBreakdown({ sources }: { sources: any[] }) {
  const max = sources.length > 0 ? Math.max(...sources.map(s => s.count)) : 1
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#ec4899', '#f97316']
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">📣 Contacts by Source</h3>
      {sources.length === 0 ? <p className="text-xs text-gray-400">No source data yet</p> : (
        <BarChart items={sources} maxValue={max} valueKey="count" labelKey="name" colorFn={(_, i) => colors[i % colors.length]} />
      )}
    </div>
  )
}

function SourceRevenue({ sources }: { sources: any[] }) {
  const withRevenue = sources.filter(s => s.revenue > 0).sort((a, b) => b.revenue - a.revenue)
  const max = withRevenue.length > 0 ? Math.max(...withRevenue.map(s => s.revenue)) : 1
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">💷 Revenue by Source</h3>
      {withRevenue.length === 0 ? <p className="text-xs text-gray-400">No revenue data yet</p> : (
        <BarChart items={withRevenue} maxValue={max} valueKey="revenue" labelKey="name" colorFn={() => '#22c55e'} formatValue={v => `£${v.toLocaleString()}`} />
      )}
    </div>
  )
}

function PipelineFunnel({ stages }: { stages: any[] }) {
  const maxCount = stages.length > 0 ? Math.max(...stages.map(s => s.count)) : 1
  const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d4a5ff']
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">🔄 Pipeline Funnel</h3>
      {stages.length === 0 ? <p className="text-xs text-gray-400">No pipeline data</p> : (
        <div className="space-y-2">
          {stages.map((stage, i) => {
            const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{stage.name}</span>
                  <div className="flex gap-3">
                    <span className="text-xs text-gray-500">{stage.count} deals</span>
                    <span className="text-xs font-bold text-green-600">£{stage.value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="h-7 bg-gray-100 rounded-lg overflow-hidden" style={{ width: `${Math.max(pct, 15)}%`, transition: 'width 0.5s' }}>
                  <div className="h-full rounded-lg flex items-center justify-center" style={{ background: colors[i % colors.length], width: '100%' }}>
                    <span className="text-[10px] font-bold text-white">{stage.count}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MonthlyRevenue({ data }: { data: any[] }) {
  const maxRev = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">📉 Monthly Revenue</h3>
      <div className="flex items-end gap-2" style={{ height: '140px' }}>
        {data.map((m, i) => {
          const pct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-gray-700">£{m.revenue > 999 ? `${(m.revenue / 1000).toFixed(1)}k` : m.revenue}</span>
              <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 4)}%`, background: i === data.length - 1 ? '#22c55e' : '#e5e7eb' }} />
              <span className="text-[10px] text-gray-500">{m.shortMonth}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthlyCustomers({ data }: { data: any[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">📈 New Contacts / Month</h3>
      <div className="flex items-end gap-2" style={{ height: '120px' }}>
        {data.map((m, i) => {
          const pct = maxCount > 0 ? (m.count / maxCount) * 100 : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-gray-700">{m.count}</span>
              <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 4)}%`, background: '#6366f1' }} />
              <span className="text-[10px] text-gray-500">{m.shortMonth}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TagAnalytics({ tags }: { tags: any[] }) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">🏷️ Tag Breakdown</h3>
      {tags.length === 0 ? <p className="text-xs text-gray-400">No tagged contacts yet</p> : (
        <div className="space-y-2">
          {tags.slice(0, 10).map((tag, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">{tag.name}</span>
                <span className="text-xs text-gray-500">{tag.count} contact{tag.count !== 1 ? 's' : ''}</span>
              </div>
              {tag.revenue > 0 && <span className="text-xs font-bold text-green-600">£{tag.revenue.toLocaleString()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuoteWinRate({ accepted, declined, sent, draft, total }: { accepted: number; declined: number; sent: number; draft: number; total: number }) {
  const segments = [
    { label: 'Accepted', count: accepted, color: '#22c55e' },
    { label: 'Sent', count: sent, color: '#3b82f6' },
    { label: 'Draft', count: draft, color: '#9ca3af' },
    { label: 'Declined', count: declined, color: '#ef4444' },
  ].filter(s => s.count > 0)
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">✅ Quote Outcomes</h3>
      {total === 0 ? <p className="text-xs text-gray-400">No quotes yet</p> : (
        <>
          <div className="flex h-6 rounded-full overflow-hidden mb-4">
            {segments.map((seg, i) => (
              <div key={i} style={{ width: `${(seg.count / total) * 100}%`, background: seg.color }} className="transition-all duration-500" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                <span className="text-xs text-gray-600">{seg.label}</span>
                <span className="text-xs font-bold text-gray-800 ml-auto">{seg.count} ({Math.round((seg.count / total) * 100)}%)</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BusiestDays({ days }: { days: any[] }) {
  const max = Math.max(...days.map(d => d.count), 1)
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">🗓️ Busiest Days</h3>
      <div className="flex items-end gap-1.5" style={{ height: '100px' }}>
        {days.map((d, i) => {
          const pct = max > 0 ? (d.count / max) * 100 : 0
          const isTop = d.count === max && d.count > 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-[10px] font-bold ${isTop ? 'text-blue-600' : 'text-gray-500'}`}>{d.count}</span>
              <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(pct, 4)}%`, background: isTop ? '#3b82f6' : '#e5e7eb' }} />
              <span className="text-[9px] text-gray-500">{d.day.slice(0, 3)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomerLtv({ customers }: { customers: any[] }) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">⭐ Top Customers</h3>
      {customers.length === 0 ? <p className="text-xs text-gray-400">No customer revenue data yet</p> : (
        <div className="space-y-1.5">
          {customers.slice(0, 8).map((c, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
              <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">{c.name.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{c.name}</p>
                <p className="text-[10px] text-gray-400">{c.dealCount} deal{c.dealCount !== 1 ? 's' : ''} · {c.jobCount} job{c.jobCount !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-xs font-bold text-green-600">£{c.totalValue.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const COST_ICONS: Record<string, string> = { fuel: '⛽', labour: '👷', materials: '📦', packing: '🎁', tolls: '🅿️', storage: '🏪', subcontractor: '🤝', vehicle: '🔧', insurance: '🛡️', other: '📋' }

function CostBreakdown({ costs, total }: { costs: any[]; total: number }) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">💸 Cost Breakdown</h3>
      <p className="text-xs text-gray-400 mb-4">Total: £{total.toFixed(2)}</p>
      {costs.length === 0 ? <p className="text-xs text-gray-400">No costs logged yet</p> : (
        <div className="space-y-2">
          {costs.map((c, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-sm">{COST_ICONS[c.category] || '📋'}</span>
              <span className="text-xs text-gray-700 flex-1 capitalize">{c.category}</span>
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: `${total > 0 ? (c.amount / total) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold text-red-600 w-16 text-right">£{c.amount.toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PnlSummary({ revenue, costs }: { revenue: number; costs: number }) {
  const profit = revenue - costs
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0'
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">📋 Profit & Loss</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">Revenue</span>
          <span className="text-lg font-bold text-green-600">£{revenue.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-600">Costs</span>
          <span className="text-lg font-bold text-red-600">-£{costs.toLocaleString()}</span>
        </div>
        <div className="border-t-2 border-gray-900 pt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">Net Profit</span>
          <span className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{profit.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Margin</span>
          <span className={`text-sm font-bold ${parseFloat(margin) >= 20 ? 'text-green-600' : parseFloat(margin) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{margin}%</span>
        </div>
      </div>
    </div>
  )
}

function JobProfitability({ jobs }: { jobs: any[] }) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">🏆 Job Profitability</h3>
      {jobs.length === 0 ? <p className="text-xs text-gray-400">No completed jobs with cost data</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-gray-500 font-semibold">Customer</th>
                <th className="text-right py-2 text-gray-500 font-semibold">Revenue</th>
                <th className="text-right py-2 text-gray-500 font-semibold">Costs</th>
                <th className="text-right py-2 text-gray-500 font-semibold">Profit</th>
                <th className="text-right py-2 text-gray-500 font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.slice(0, 10).map((job, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-800">{job.name}</td>
                  <td className="py-2 text-right text-green-600 font-semibold">£{job.revenue.toLocaleString()}</td>
                  <td className="py-2 text-right text-red-600">{job.costs > 0 ? `-£${job.costs.toFixed(0)}` : '—'}</td>
                  <td className={`py-2 text-right font-bold ${job.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{job.profit.toFixed(0)}</td>
                  <td className="py-2 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${job.margin >= 20 ? 'bg-green-100 text-green-700' : job.margin >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{job.margin.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RevenueByStage({ stages }: { stages: any[] }) {
  const max = stages.length > 0 ? Math.max(...stages.map(s => s.value)) : 1
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">📶 Value by Stage</h3>
      {stages.length === 0 ? <p className="text-xs text-gray-400">No pipeline data</p> : (
        <BarChart items={stages} maxValue={max} valueKey="value" labelKey="name" colorFn={() => '#6366f1'} formatValue={v => `£${v.toLocaleString()}`} />
      )}
    </div>
  )
}

function LeadAge({ leads }: { leads: any[] }) {
  const sorted = [...leads].sort((a, b) => b.days - a.days)
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">⏱️ Lead Age (days in pipeline)</h3>
      {sorted.length === 0 ? <p className="text-xs text-gray-400">No deals yet</p> : (
        <div className="space-y-1.5">
          {sorted.slice(0, 8).map((lead, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50">
              <span className="text-xs text-gray-700 flex-1 truncate">{lead.name}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lead.days > 30 ? 'bg-red-100 text-red-700' : lead.days > 14 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{lead.days}d</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RecentActivity() {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">🔔 Recent Activity</h3>
      <p className="text-xs text-gray-400">Activity feed coming soon</p>
    </div>
  )
}

function StageDuration({ stages }: { stages: any[] }) {
  return (
    <div className="p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">⏳ Stage Distribution</h3>
      {stages.length === 0 ? <p className="text-xs text-gray-400">No pipeline data</p> : (
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
              <span className="text-xs font-medium text-gray-700">{s.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{s.count} deal{s.count !== 1 ? 's' : ''}</span>
                <span className="text-xs font-bold text-green-600">£{s.value.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
