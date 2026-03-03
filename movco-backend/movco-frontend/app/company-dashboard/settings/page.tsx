// app/company-dashboard/settings/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type SettingsTab = 'fleet' | 'hours' | 'areas' | 'pricing' | 'booking' | 'calendar';

type Van = { name: string; type: string; capacity_cubic_ft: number; reg: string; mot_date: string; active: boolean };
type DayHours = { start: string; end: string; closed: boolean };
type WorkingHours = Record<string, DayHours>;
type ServiceAreas = { base_postcode: string; max_radius_miles: number; excluded_postcodes: string[] };
type PricingRules = { hourly_rate: number; minimum_hours: number; fuel_surcharge_pct: number; congestion_charge: number; stair_charge_per_flight: number; packing_rate_per_hour: number };
type BookingSettings = { min_notice_hours: number; max_advance_days: number; deposit_required: boolean; deposit_pct: number };

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<SettingsTab>('fleet');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Config state
  const [vans, setVans] = useState<Van[]>([]);
  const [hours, setHours] = useState<WorkingHours>({});
  const [areas, setAreas] = useState<ServiceAreas>({ base_postcode: '', max_radius_miles: 50, excluded_postcodes: [] });
  const [pricing, setPricing] = useState<PricingRules>({ hourly_rate: 45, minimum_hours: 2, fuel_surcharge_pct: 5, congestion_charge: 15, stair_charge_per_flight: 25, packing_rate_per_hour: 35 });
  const [booking, setBooking] = useState<BookingSettings>({ min_notice_hours: 24, max_advance_days: 90, deposit_required: true, deposit_pct: 25 });

  // Calendar state
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: co } = await supabase
        .from('companies').select('id, company_name, calendar_feed_token, calendar_feed_enabled')
        .eq('user_id', user.id).maybeSingle();
      if (!co) { setLoading(false); return; }

      setCompanyId(co.id);
      setCompanyName(co.company_name || '');
      setCalendarEnabled(co.calendar_feed_enabled || false);
      setCalendarToken(co.calendar_feed_token || null);

      const { data: config } = await supabase
        .from('company_config').select('*').eq('company_id', co.id).maybeSingle();

      if (config) {
        setVans(config.vans || []);
        setHours(config.working_hours || {});
        setAreas(config.service_areas || { base_postcode: '', max_radius_miles: 50, excluded_postcodes: [] });
        setPricing(config.pricing_rules || {});
        setBooking(config.booking_settings || {});
      } else {
        // Create default config
        await supabase.from('company_config').insert({ company_id: co.id });
      }
      setLoading(false);
    })();
  }, [user]);

  const saveConfig = useCallback(async (field: string, value: any) => {
    if (!companyId) return;
    setSaving(true);
    await supabase.from('company_config')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('company_id', companyId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [companyId]);

  // Calendar feed
  const enableCalendarFeed = async () => {
    if (!companyId) return;
    const token = crypto.randomUUID().replace(/-/g, '');
    await supabase.from('companies')
      .update({ calendar_feed_token: token, calendar_feed_enabled: true })
      .eq('id', companyId);
    setCalendarToken(token);
    setCalendarEnabled(true);
  };

  const disableCalendarFeed = async () => {
    if (!companyId) return;
    await supabase.from('companies')
      .update({ calendar_feed_enabled: false })
      .eq('id', companyId);
    setCalendarEnabled(false);
  };

  const copyFeedUrl = async () => {
    if (!calendarToken) return;
    const url = `${window.location.origin}/api/calendar/feed/${calendarToken}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Calendar feed URL copied to clipboard!\n\nOpen Google Calendar → Settings → Add by URL → Paste');
    } catch {
      prompt('Copy this calendar feed URL:', url);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-700 font-medium">Loading settings...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const tabs: { key: SettingsTab; label: string; icon: string }[] = [
    { key: 'fleet', label: 'Fleet', icon: '🚛' },
    { key: 'hours', label: 'Hours', icon: '🕐' },
    { key: 'areas', label: 'Areas', icon: '📍' },
    { key: 'pricing', label: 'Pricing', icon: '💰' },
    { key: 'booking', label: 'Booking', icon: '📋' },
    { key: 'calendar', label: 'Calendar', icon: '📅' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/company-dashboard')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
          {saved && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                tab === t.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ═══════ FLEET TAB ═══════ */}
        {tab === 'fleet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Fleet Management</h2>
                <p className="text-sm text-gray-500">{vans.filter(v => v.active).length} active van{vans.filter(v => v.active).length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => {
                const updated = [...vans, { name: `Van ${vans.length + 1}`, type: 'Luton', capacity_cubic_ft: 550, reg: '', mot_date: '', active: true }];
                setVans(updated);
                saveConfig('vans', updated);
              }} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
                + Add Van
              </button>
            </div>

            {vans.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <p className="text-gray-500">No vans configured. Add your first van to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vans.map((van, idx) => (
                  <div key={idx} className={`bg-white rounded-xl border p-5 ${!van.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">🚛</span>
                        </div>
                        <input value={van.name} onChange={e => {
                          const updated = [...vans]; updated[idx] = { ...van, name: e.target.value }; setVans(updated);
                        }} onBlur={() => saveConfig('vans', vans)}
                          className="font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none px-1 py-0.5" />
                      </div>
                      <button onClick={() => {
                        const updated = [...vans]; updated[idx] = { ...van, active: !van.active }; setVans(updated); saveConfig('vans', updated);
                      }} className={`px-3 py-1 rounded-full text-xs font-semibold transition ${van.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {van.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Type</label>
                        <select value={van.type} onChange={e => {
                          const updated = [...vans]; updated[idx] = { ...van, type: e.target.value }; setVans(updated);
                        }} onBlur={() => saveConfig('vans', vans)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                          <option value="SWB">SWB Transit</option>
                          <option value="LWB">LWB Transit</option>
                          <option value="Luton">Luton</option>
                          <option value="7.5t">7.5 Tonne</option>
                          <option value="18t">18 Tonne</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Capacity (ft³)</label>
                        <input type="number" value={van.capacity_cubic_ft} onChange={e => {
                          const updated = [...vans]; updated[idx] = { ...van, capacity_cubic_ft: parseInt(e.target.value) || 0 }; setVans(updated);
                        }} onBlur={() => saveConfig('vans', vans)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Registration</label>
                        <input value={van.reg} onChange={e => {
                          const updated = [...vans]; updated[idx] = { ...van, reg: e.target.value.toUpperCase() }; setVans(updated);
                        }} onBlur={() => saveConfig('vans', vans)} placeholder="AB12 CDE"
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">MOT Date</label>
                        <input type="date" value={van.mot_date} onChange={e => {
                          const updated = [...vans]; updated[idx] = { ...van, mot_date: e.target.value }; setVans(updated);
                        }} onBlur={() => saveConfig('vans', vans)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                    <button onClick={() => {
                      if (!confirm(`Remove ${van.name}?`)) return;
                      const updated = vans.filter((_, i) => i !== idx);
                      setVans(updated); saveConfig('vans', updated);
                    }} className="mt-3 text-xs text-red-500 hover:text-red-700 font-medium">Remove van</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════ WORKING HOURS TAB ═══════ */}
        {tab === 'hours' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Working Hours</h2>
              <p className="text-sm text-gray-500">Set your operating hours for each day of the week</p>
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              {['mon','tue','wed','thu','fri','sat','sun'].map(day => {
                const labels: Record<string,string> = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
                const h = hours[day] || { start: '08:00', end: '18:00', closed: false };
                return (
                  <div key={day} className={`flex items-center gap-4 px-5 py-4 border-b last:border-0 ${h.closed ? 'bg-gray-50' : ''}`}>
                    <div className="w-28 flex-shrink-0">
                      <p className="font-semibold text-gray-900 text-sm">{labels[day]}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                      <input type="checkbox" checked={!h.closed} onChange={e => {
                        const updated = { ...hours, [day]: { ...h, closed: !e.target.checked } };
                        setHours(updated); saveConfig('working_hours', updated);
                      }} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs text-gray-500">{h.closed ? 'Closed' : 'Open'}</span>
                    </label>
                    {!h.closed && (
                      <div className="flex items-center gap-2 flex-1">
                        <input type="time" value={h.start} onChange={e => {
                          const updated = { ...hours, [day]: { ...h, start: e.target.value } };
                          setHours(updated);
                        }} onBlur={() => saveConfig('working_hours', hours)}
                          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        <span className="text-gray-400 text-sm">to</span>
                        <input type="time" value={h.end} onChange={e => {
                          const updated = { ...hours, [day]: { ...h, end: e.target.value } };
                          setHours(updated);
                        }} onBlur={() => saveConfig('working_hours', hours)}
                          className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ SERVICE AREAS TAB ═══════ */}
        {tab === 'areas' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Service Areas</h2>
              <p className="text-sm text-gray-500">Define where you operate from and how far you travel</p>
            </div>
            <div className="bg-white rounded-xl border p-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Base Postcode</label>
                <input value={areas.base_postcode} onChange={e => setAreas({ ...areas, base_postcode: e.target.value.toUpperCase() })}
                  onBlur={() => saveConfig('service_areas', areas)} placeholder="e.g. RG12"
                  className="w-full max-w-xs px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase font-medium" />
                <p className="text-xs text-gray-400 mt-1">Your main depot or office postcode</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Maximum Radius: {areas.max_radius_miles} miles</label>
                <input type="range" min="5" max="200" value={areas.max_radius_miles}
                  onChange={e => setAreas({ ...areas, max_radius_miles: parseInt(e.target.value) })}
                  onMouseUp={() => saveConfig('service_areas', areas)}
                  onTouchEnd={() => saveConfig('service_areas', areas)}
                  className="w-full max-w-md h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                <div className="flex justify-between text-xs text-gray-400 max-w-md mt-1">
                  <span>5 miles</span><span>100 miles</span><span>200 miles</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Excluded Postcodes</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {areas.excluded_postcodes.map((pc, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-full text-xs font-semibold">
                      {pc}
                      <button onClick={() => {
                        const updated = { ...areas, excluded_postcodes: areas.excluded_postcodes.filter((_, i) => i !== idx) };
                        setAreas(updated); saveConfig('service_areas', updated);
                      }} className="hover:text-red-900">x</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input id="exclude-input" placeholder="Add postcode to exclude" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
                        if (val && !areas.excluded_postcodes.includes(val)) {
                          const updated = { ...areas, excluded_postcodes: [...areas.excluded_postcodes, val] };
                          setAreas(updated); saveConfig('service_areas', updated);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }} />
                  <p className="text-xs text-gray-400 self-center">Press Enter to add</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ PRICING TAB ═══════ */}
        {tab === 'pricing' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pricing Rules</h2>
              <p className="text-sm text-gray-500">Set your base rates and surcharges</p>
            </div>
            <div className="bg-white rounded-xl border p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { key: 'hourly_rate', label: 'Hourly Rate', prefix: '£', suffix: '/hr', desc: 'Base rate per hour for labour' },
                  { key: 'minimum_hours', label: 'Minimum Hours', prefix: '', suffix: 'hrs', desc: 'Minimum charge in hours' },
                  { key: 'fuel_surcharge_pct', label: 'Fuel Surcharge', prefix: '', suffix: '%', desc: 'Added to total as fuel cost' },
                  { key: 'congestion_charge', label: 'Congestion Charge', prefix: '£', suffix: '', desc: 'Extra charge for London zone' },
                  { key: 'stair_charge_per_flight', label: 'Stair Charge', prefix: '£', suffix: '/flight', desc: 'Per flight of stairs (no lift)' },
                  { key: 'packing_rate_per_hour', label: 'Packing Rate', prefix: '£', suffix: '/hr', desc: 'If customer wants packing service' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">{field.label}</label>
                    <div className="flex items-center gap-1">
                      {field.prefix && <span className="text-gray-500 font-medium">{field.prefix}</span>}
                      <input type="number" value={(pricing as any)[field.key]}
                        onChange={e => setPricing({ ...pricing, [field.key]: parseFloat(e.target.value) || 0 })}
                        onBlur={() => saveConfig('pricing_rules', pricing)}
                        className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                      {field.suffix && <span className="text-gray-400 text-sm">{field.suffix}</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{field.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Price preview */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
              <h3 className="font-bold mb-3">Example Quote Preview</h3>
              <p className="text-sm text-blue-200 mb-4">Based on a 6-hour, 2-man job with 1 flight of stairs:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Labour ({pricing.minimum_hours < 6 ? 6 : pricing.minimum_hours}h x £{pricing.hourly_rate})</span><span>£{(Math.max(6, pricing.minimum_hours) * pricing.hourly_rate).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Stairs (1 flight)</span><span>£{pricing.stair_charge_per_flight.toFixed(2)}</span></div>
                {pricing.fuel_surcharge_pct > 0 && (
                  <div className="flex justify-between"><span>Fuel surcharge ({pricing.fuel_surcharge_pct}%)</span><span>£{((Math.max(6, pricing.minimum_hours) * pricing.hourly_rate * pricing.fuel_surcharge_pct / 100)).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-white/20 pt-2 mt-2">
                  <span>Total</span>
                  <span>£{(
                    Math.max(6, pricing.minimum_hours) * pricing.hourly_rate +
                    pricing.stair_charge_per_flight +
                    (Math.max(6, pricing.minimum_hours) * pricing.hourly_rate * pricing.fuel_surcharge_pct / 100)
                  ).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ BOOKING TAB ═══════ */}
        {tab === 'booking' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Booking Rules</h2>
              <p className="text-sm text-gray-500">Control how far in advance customers can book and deposit requirements</p>
            </div>
            <div className="bg-white rounded-xl border p-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Minimum Notice</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={booking.min_notice_hours}
                    onChange={e => setBooking({ ...booking, min_notice_hours: parseInt(e.target.value) || 0 })}
                    onBlur={() => saveConfig('booking_settings', booking)}
                    className="w-24 px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-gray-500 text-sm">hours</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Minimum advance notice required for bookings</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Maximum Advance Booking</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={booking.max_advance_days}
                    onChange={e => setBooking({ ...booking, max_advance_days: parseInt(e.target.value) || 0 })}
                    onBlur={() => saveConfig('booking_settings', booking)}
                    className="w-24 px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                  <span className="text-gray-500 text-sm">days</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">How far ahead customers can book</p>
              </div>

              <div className="border-t pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Require Deposit</label>
                    <p className="text-xs text-gray-400">Ask customers for a deposit to confirm booking</p>
                  </div>
                  <button onClick={() => {
                    const updated = { ...booking, deposit_required: !booking.deposit_required };
                    setBooking(updated); saveConfig('booking_settings', updated);
                  }} className={`w-12 h-6 rounded-full transition-all flex items-center ${booking.deposit_required ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'}`}>
                    <div className="w-5 h-5 bg-white rounded-full shadow mx-0.5" />
                  </button>
                </div>
                {booking.deposit_required && (
                  <div className="flex items-center gap-2">
                    <input type="number" value={booking.deposit_pct}
                      onChange={e => setBooking({ ...booking, deposit_pct: parseInt(e.target.value) || 0 })}
                      onBlur={() => saveConfig('booking_settings', booking)}
                      className="w-20 px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
                    <span className="text-gray-500 text-sm">% of quote total</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ CALENDAR TAB ═══════ */}
        {tab === 'calendar' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Calendar Sync</h2>
              <p className="text-sm text-gray-500">Subscribe to your MOVCO diary from Google Calendar, Apple Calendar, or Outlook</p>
            </div>

            <div className="bg-white rounded-xl border p-6">
              {!calendarEnabled ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">📅</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Enable Calendar Feed</h3>
                  <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                    Generate a subscribe link so your diary events appear in your favourite calendar app automatically.
                  </p>
                  <button onClick={enableCalendarFeed}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
                    Enable Calendar Feed
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-semibold text-green-700">Calendar feed is active</span>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">Your feed URL</label>
                    <div className="flex gap-2">
                      <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/calendar/feed/${calendarToken}`}
                        className="flex-1 px-4 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-600 font-mono truncate" />
                      <button onClick={copyFeedUrl}
                        className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition flex-shrink-0">
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <h4 className="font-semibold text-blue-800 mb-3">How to add to your calendar:</h4>
                    <div className="space-y-3 text-sm text-blue-700">
                      <div className="flex gap-3">
                        <span className="font-bold text-blue-600">1.</span>
                        <span>Copy the feed URL above</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="font-bold text-blue-600">2.</span>
                        <div>
                          <p className="font-medium">Google Calendar:</p>
                          <p className="text-blue-600">Settings → Add calendar → From URL → Paste</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="font-bold text-blue-600">3.</span>
                        <div>
                          <p className="font-medium">Apple Calendar:</p>
                          <p className="text-blue-600">File → New Calendar Subscription → Paste URL</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="font-bold text-blue-600">4.</span>
                        <div>
                          <p className="font-medium">Outlook:</p>
                          <p className="text-blue-600">Add calendar → Subscribe from web → Paste URL</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-blue-500 mt-3">Events sync automatically every 1-12 hours depending on your calendar app.</p>
                  </div>

                  <button onClick={disableCalendarFeed}
                    className="text-sm text-red-500 hover:text-red-700 font-medium">
                    Disable calendar feed
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
