// components/SimpleQuoteBuilder.tsx
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
}

export default function SimpleQuoteBuilder({ company, onSave, onCancel, prefill, pdfBranding }: {
  company: Company;
  onSave: (q: Partial<CrmQuote>) => void;
  onCancel: () => void;
  prefill?: QuotePrefill | null;
  pdfBranding?: any;
}) {
  // Customer
  const [customerName, setCustomerName] = useState(prefill?.customer_name || '');
  const [customerEmail, setCustomerEmail] = useState(prefill?.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState(prefill?.customer_phone || '');
  const [address, setAddress] = useState(prefill?.moving_from || '');
  const [date, setDate] = useState(prefill?.moving_date || '');

  // Items
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0 },
  ]);

  // Extras
  const [notes, setNotes] = useState(prefill?.notes || '');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [vatRate, setVatRate] = useState('0');
  const [includeVat, setIncludeVat] = useState(false);
  const [validUntil, setValidUntil] = useState('');

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now().toString(), description: '', quantity: 1, unit_price: 0 }]);
  };

  const updateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Totals
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const discountAmount = discountType === 'percent'
    ? subtotal * (parseFloat(discount) || 0) / 100
    : parseFloat(discount) || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const vatAmount = includeVat ? afterDiscount * (parseFloat(vatRate) || 0) / 100 : 0;
  const grandTotal = afterDiscount + vatAmount;

  const handleSave = () => {
    if (!customerName.trim()) { alert('Please enter a customer name'); return; }
    if (items.filter(i => i.description.trim()).length === 0) { alert('Add at least one item'); return; }

    onSave({
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      moving_from: address || null,
      moving_to: null,
      moving_date: date || null,
      items: items.filter(i => i.description.trim()).map(i => ({
        name: i.description,
        quantity: i.quantity,
        note: `£${i.unit_price.toFixed(2)} × ${i.quantity}`,
        unit_price: i.unit_price,
      })),
      total_volume_m3: 0,
      van_count: 0,
      movers: 0,
      estimated_price: Math.round(grandTotal * 100) / 100,
      distance_miles: null,
      estimated_hours: null,
      cost_breakdown: [],
      notes: notes || null,
      valid_until: validUntil || null,
      status: 'draft',
      deal_id: prefill?.deal_id || null,
    });
  };

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
            <p className="text-sm text-gray-500">{prefill ? `For ${prefill.customer_name}` : 'Create a quote with line items'}</p>
          </div>
        </div>
        {/* Live total */}
        <div className="text-right">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-green-600">£{grandTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Customer details */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 mb-4">Customer Details</h3>
          <div className="space-y-3">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name *" className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Email" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address / Location" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Quote Items</h3>
            <button onClick={addItem} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
              + Add Item
            </button>
          </div>

          {/* Column headers */}
          <div className="px-6 py-2 bg-gray-50 border-b flex items-center gap-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div className="flex-1">Description</div>
            <div className="w-20 text-center">Qty</div>
            <div className="w-24 text-center">Unit Price</div>
            <div className="w-24 text-right">Total</div>
            <div className="w-8" />
          </div>

          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={item.id} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition group">
                {/* Description */}
                <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)}
                  placeholder={`Item ${idx + 1}...`}
                  className="flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />

                {/* Qty */}
                <input type="number" min="1" step="1" value={item.quantity}
                  onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                  className="w-20 px-2 py-2.5 border rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" />

                {/* Price */}
                <div className="w-24 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <input type="number" min="0" step="0.01" value={item.unit_price || ''}
                    onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-2.5 border rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                {/* Line total */}
                <div className="w-24 text-right">
                  <span className="text-sm font-bold text-gray-900">£{(item.quantity * item.unit_price).toFixed(2)}</span>
                </div>

                {/* Delete */}
                <button onClick={() => removeItem(item.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                    items.length <= 1 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                  }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add another */}
          <div className="px-6 py-3 border-t">
            <button onClick={addItem} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
              + Add another item
            </button>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 bg-gray-50 border-t space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">£{subtotal.toFixed(2)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Discount</span>
                <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                  className="w-16 px-2 py-1 border rounded text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                <select value={discountType} onChange={e => setDiscountType(e.target.value as any)}
                  className="px-2 py-1 border rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="percent">%</option>
                  <option value="fixed">£</option>
                </select>
              </div>
              <span className="font-semibold text-gray-900">{discountAmount > 0 ? `-£${discountAmount.toFixed(2)}` : '—'}</span>
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
                    <input type="number" min="0" max="25" value={vatRate} onChange={e => setVatRate(e.target.value)}
                      className="w-14 px-2 py-1 border rounded text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none" />
                    <span className="text-gray-400 text-xs">%</span>
                  </>
                )}
              </div>
              <span className="font-semibold text-gray-900">{includeVat && vatAmount > 0 ? `+£${vatAmount.toFixed(2)}` : '—'}</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200">
              <span className="font-bold text-gray-900 text-lg">Total</span>
              <span className="text-3xl font-bold text-green-600">£{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes + Valid until */}
        <div className="bg-white rounded-xl border p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <h3 className="font-bold text-gray-900 mb-3">Notes</h3>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes, terms, or details..." rows={3}
                className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Valid Until</h3>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <p className="text-[10px] text-gray-400 mt-1">Optional — shown on PDF</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onCancel} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-green-600 text-white font-semibold py-3.5 rounded-xl hover:bg-green-700 transition text-lg shadow-lg">
            Save Quote — £{grandTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}