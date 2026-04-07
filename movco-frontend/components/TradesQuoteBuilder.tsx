// components/TradesQuoteBuilder.tsx
'use client';

import { useState } from 'react';

type CrmQuote = any;
type Company = { id: string; name: string; email: string; phone: string };
type QuotePrefill = { customer_name: string; customer_email: string; customer_phone: string; moving_from: string; moving_to: string; moving_date: string; notes: string; deal_id: string | null };

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  type: 'labour' | 'parts' | 'materials' | 'callout' | 'other';
}

const ITEM_TYPES = [
  { key: 'labour', label: 'Labour', icon: '👷', color: 'bg-blue-100 text-blue-700' },
  { key: 'parts', label: 'Parts', icon: '🔧', color: 'bg-amber-100 text-amber-700' },
  { key: 'materials', label: 'Materials', icon: '📦', color: 'bg-purple-100 text-purple-700' },
  { key: 'callout', label: 'Callout / Travel', icon: '🚗', color: 'bg-green-100 text-green-700' },
  { key: 'other', label: 'Other', icon: '📋', color: 'bg-gray-100 text-gray-700' },
];

export default function TradesQuoteBuilder({ company, onSave, onCancel, prefill, pdfBranding }: {
  company: Company;
  onSave: (q: Partial<CrmQuote>) => void;
  onCancel: () => void;
  prefill?: QuotePrefill | null;
  pdfBranding?: any;
}) {
  const [step, setStep] = useState<'details' | 'items' | 'review'>(prefill ? 'items' : 'details');

  // Customer fields
  const [customerName, setCustomerName] = useState(prefill?.customer_name || '');
  const [customerEmail, setCustomerEmail] = useState(prefill?.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState(prefill?.customer_phone || '');
  const [jobAddress, setJobAddress] = useState(prefill?.moving_from || '');
  const [jobDate, setJobDate] = useState(prefill?.moving_date || '');
  const [jobDescription, setJobDescription] = useState(prefill?.notes || '');

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0, type: 'labour' },
  ]);

  // Notes & markup
  const [notes, setNotes] = useState('');
  const [markup, setMarkup] = useState('0');
  const [vatRate, setVatRate] = useState('20');
  const [includeVat, setIncludeVat] = useState(true);

  // Quick-add presets
  const PRESETS: { label: string; type: LineItem['type']; description: string; unit_price: number }[] = [
    { label: 'Callout Charge', type: 'callout', description: 'Callout / diagnostic charge', unit_price: 75 },
    { label: '1hr Labour', type: 'labour', description: 'Labour (1 hour)', unit_price: 50 },
    { label: 'Half Day', type: 'labour', description: 'Labour (half day — 4hrs)', unit_price: 200 },
    { label: 'Full Day', type: 'labour', description: 'Labour (full day — 8hrs)', unit_price: 350 },
  ];

  const addItem = (type: LineItem['type'] = 'parts') => {
    setItems(prev => [...prev, { id: Date.now().toString(), description: '', quantity: 1, unit_price: 0, type }]);
  };

  const addPreset = (preset: typeof PRESETS[0]) => {
    setItems(prev => [...prev, { id: Date.now().toString(), description: preset.description, quantity: 1, unit_price: preset.unit_price, type: preset.type }]);
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Totals
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const markupAmount = subtotal * (parseFloat(markup) || 0) / 100;
  const preVatTotal = subtotal + markupAmount;
  const vatAmount = includeVat ? preVatTotal * (parseFloat(vatRate) || 0) / 100 : 0;
  const grandTotal = preVatTotal + vatAmount;

  // Category totals
  const categoryTotals = ITEM_TYPES.map(t => ({
    ...t,
    total: items.filter(i => i.type === t.key).reduce((s, i) => s + (i.quantity * i.unit_price), 0),
    count: items.filter(i => i.type === t.key).length,
  })).filter(c => c.total > 0);

  const handleSave = () => {
    if (!customerName.trim()) { alert('Please enter a customer name'); return; }
    onSave({
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      moving_from: jobAddress || null,
      moving_to: null,
      moving_date: jobDate || null,
      items: items.filter(i => i.description.trim()).map(i => ({
        name: i.description,
        quantity: i.quantity,
        note: `${ITEM_TYPES.find(t => t.key === i.type)?.label || 'Other'} — £${i.unit_price.toFixed(2)} × ${i.quantity}`,
        type: i.type,
        unit_price: i.unit_price,
      })),
      total_volume_m3: 0,
      van_count: 0,
      movers: 0,
      estimated_price: Math.round(grandTotal * 100) / 100,
      distance_miles: null,
      estimated_hours: items.filter(i => i.type === 'labour').reduce((s, i) => s + i.quantity, 0),
      cost_breakdown: categoryTotals.map(c => ({
        category: c.key,
        description: `${c.count} item${c.count !== 1 ? 's' : ''}`,
        amount: c.total,
      })),
      notes: [jobDescription, notes].filter(Boolean).join('\n\n') || null,
      status: 'draft',
      deal_id: prefill?.deal_id || null,
    });
  };

  const steps = [
    { key: 'details', label: 'Job Details' },
    { key: 'items', label: 'Quote Items' },
    { key: 'review', label: 'Review & Save' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">New Quote</h2>
            <p className="text-sm text-gray-500">{prefill ? `For ${prefill.customer_name}` : 'Labour, parts & materials'}</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => {
          const stepKeys = ['details', 'items', 'review'];
          const currentIdx = stepKeys.indexOf(step);
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-gray-400'}`}>{s.label}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${isDone ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {/* ═══ STEP 1: JOB DETAILS ═══ */}
      {step === 'details' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4">Customer Details</h3>
            <div className="space-y-3">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name *" className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Email" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4">Job Details</h3>
            <div className="space-y-3">
              <input value={jobAddress} onChange={e => setJobAddress(e.target.value)} placeholder="Job address" className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Job date</label>
                <input type="date" value={jobDate} onChange={e => setJobDate(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Description of work..." rows={3} className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>

          <button onClick={() => { if (!customerName.trim()) return alert('Customer name is required'); setStep('items'); }}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg">
            Next — Add Quote Items →
          </button>
        </div>
      )}

      {/* ═══ STEP 2: QUOTE ITEMS ═══ */}
      {step === 'items' && (
        <div className="space-y-6">
          {/* Quick presets */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-3">Quick Add</h3>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p, i) => (
                <button key={i} onClick={() => addPreset(p)}
                  className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition border border-blue-200">
                  + {p.label} (£{p.unit_price})
                </button>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white rounded-xl border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Quote Items ({items.length})</h3>
              <div className="flex gap-2">
                {ITEM_TYPES.map(t => (
                  <button key={t.key} onClick={() => addItem(t.key as LineItem['type'])}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition border ${t.color} border-current/20 hover:opacity-80`}>
                    {t.icon} + {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y">
              {items.map((item, idx) => {
                const typeInfo = ITEM_TYPES.find(t => t.key === item.type) || ITEM_TYPES[4];
                return (
                  <div key={item.id} className="px-6 py-4 hover:bg-gray-50 transition group">
                    <div className="flex items-start gap-3">
                      {/* Type badge */}
                      <select value={item.type} onChange={e => updateItem(item.id, 'type', e.target.value)}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border-0 outline-none cursor-pointer ${typeInfo.color} mt-1`}>
                        {ITEM_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                      </select>

                      {/* Description */}
                      <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Description..."
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />

                      {/* Qty */}
                      <div className="w-20">
                        <label className="text-[10px] text-gray-400 block mb-0.5">Qty</label>
                        <input type="number" min="1" step="0.5" value={item.quantity}
                          onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                          className="w-full px-2 py-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>

                      {/* Unit price */}
                      <div className="w-24">
                        <label className="text-[10px] text-gray-400 block mb-0.5">Unit £</label>
                        <input type="number" min="0" step="0.01" value={item.unit_price || ''}
                          onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-2 border rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>

                      {/* Line total */}
                      <div className="w-24 text-right pt-6">
                        <span className="text-sm font-bold text-gray-900">£{(item.quantity * item.unit_price).toFixed(2)}</span>
                      </div>

                      {/* Delete */}
                      <button onClick={() => removeItem(item.id)}
                        className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 mt-6">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400">
                  <p className="text-sm">No items yet — use Quick Add or the buttons above</p>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="px-6 py-4 bg-gray-50 border-t space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold text-gray-900">£{subtotal.toFixed(2)}</span>
              </div>

              {/* Markup */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Markup</span>
                  <input type="number" min="0" max="100" value={markup}
                    onChange={e => setMarkup(e.target.value)}
                    className="w-16 px-2 py-1 border rounded text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-gray-400 text-xs">%</span>
                </div>
                <span className="font-semibold text-gray-900">{markupAmount > 0 ? `+£${markupAmount.toFixed(2)}` : '—'}</span>
              </div>

              {/* VAT */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} className="w-3.5 h-3.5 text-blue-600 rounded" />
                    <span className="text-gray-600">VAT</span>
                  </label>
                  {includeVat && (
                    <>
                      <input type="number" min="0" max="25" value={vatRate}
                        onChange={e => setVatRate(e.target.value)}
                        className="w-14 px-2 py-1 border rounded text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                      <span className="text-gray-400 text-xs">%</span>
                    </>
                  )}
                </div>
                <span className="font-semibold text-gray-900">{includeVat ? `+£${vatAmount.toFixed(2)}` : '—'}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-green-600">£{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-3">Additional Notes</h3>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms, payment info, warranty details..." rows={3}
              className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
            <button onClick={() => { if (items.filter(i => i.description.trim()).length === 0) return alert('Add at least one item'); setStep('review'); }}
              className="flex-1 bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg">
              Review Quote →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: REVIEW ═══ */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* Price banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-200">Quote Total{includeVat ? ' (inc. VAT)' : ''}</p>
                <p className="text-4xl font-bold">£{grandTotal.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-200">Customer</p>
                <p className="text-lg font-semibold">{customerName}</p>
              </div>
            </div>
            {jobAddress && <p className="text-sm text-blue-200 mt-2">📍 {jobAddress}</p>}
          </div>

          {/* Category breakdown */}
          {categoryTotals.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold text-gray-900 mb-3">Breakdown</h3>
              <div className="space-y-2">
                {categoryTotals.map(c => (
                  <div key={c.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{c.icon} {c.label} ({c.count} item{c.count !== 1 ? 's' : ''})</span>
                    <span className="text-sm font-semibold text-gray-900">£{c.total.toFixed(2)}</span>
                  </div>
                ))}
                {markupAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Markup ({markup}%)</span>
                    <span className="text-sm font-semibold text-gray-900">+£{markupAmount.toFixed(2)}</span>
                  </div>
                )}
                {includeVat && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">VAT ({vatRate}%)</span>
                    <span className="text-sm font-semibold text-gray-900">+£{vatAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items list */}
          <div className="bg-white rounded-xl border">
            <div className="px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Items ({items.filter(i => i.description.trim()).length})</h3>
            </div>
            <div className="divide-y">
              {items.filter(i => i.description.trim()).map(item => {
                const typeInfo = ITEM_TYPES.find(t => t.key === item.type) || ITEM_TYPES[4];
                return (
                  <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                      <span className="text-sm text-gray-800">{item.description}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.quantity > 1 && <span className="text-gray-400">{item.quantity} × £{item.unit_price.toFixed(2)} = </span>}
                      <span className="font-semibold text-gray-900">£{(item.quantity * item.unit_price).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Job description + notes */}
          {(jobDescription || notes) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-yellow-900 whitespace-pre-wrap">{[jobDescription, notes].filter(Boolean).join('\n\n')}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('items')} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Edit Items</button>
            <button onClick={handleSave} className="flex-1 bg-green-600 text-white font-semibold py-3.5 rounded-xl hover:bg-green-700 transition text-lg shadow-lg">
              Save Quote — £{grandTotal.toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}