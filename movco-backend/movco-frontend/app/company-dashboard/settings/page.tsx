// app/company-dashboard/settings/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type SettingsSection = 'company' | 'team' | 'fleet' | 'hours' | 'areas' | 'pricing' | 'booking' | 'calendar' | 'email' | 'import' | 'billing';

type Van = { name: string; type: string; capacity_cubic_ft: number; reg: string; mot_date: string; active: boolean };
type DayHours = { start: string; end: string; closed: boolean };
type WorkingHours = Record<string, DayHours>;
type ServiceAreas = { base_postcode: string; max_radius_miles: number; excluded_postcodes: string[] };
type PricingRules = { hourly_rate: number; minimum_hours: number; fuel_surcharge_pct: number; congestion_charge: number; stair_charge_per_flight: number; packing_rate_per_hour: number };
type BookingSettings = { min_notice_hours: number; max_advance_days: number; deposit_required: boolean; deposit_pct: number };
type TeamMember = { id: string; email: string; full_name: string; role: string; status: string; created_at: string };

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [section, setSection] = useState<SettingsSection>('company');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
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

  // Email state
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(true);

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('driver');

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importType, setImportType] = useState('customers');
  const [importStatus, setImportStatus] = useState('');

  // CRM state
  const [crmActive, setCrmActive] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth');
  }, [user, authLoading, router]);

  // Handle email OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('email') === 'connected') {
      const addr = params.get('address');
      alert(`✅ Gmail connected! Emails will be sent from ${addr || 'your Gmail'}`);
      setEmailConnected(true);
      setEmailAddress(addr || null);
      setSection('email');
      window.history.replaceState({}, '', '/company-dashboard/settings');
    } else if (params.get('email') === 'error') {
      alert(`❌ Gmail connection failed: ${params.get('reason') || 'unknown error'}. Please try again.`);
      setSection('email');
      window.history.replaceState({}, '', '/company-dashboard/settings');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: co } = await supabase
        .from('companies').select('*')
        .eq('user_id', user.id).maybeSingle();
      if (!co) { setLoading(false); return; }

      setCompanyId(co.id);
      setCompany(co);
      setCalendarEnabled(co.calendar_feed_enabled || false);
      setCalendarToken(co.calendar_feed_token || null);
      setCrmActive(co.crm_active || false);

      const { data: config } = await supabase
        .from('company_config').select('*').eq('company_id', co.id).maybeSingle();

      if (config) {
        setVans(config.vans || []);
        setHours(config.working_hours || {});
        setAreas(config.service_areas || { base_postcode: '', max_radius_miles: 50, excluded_postcodes: [] });
        setPricing(config.pricing_rules || { hourly_rate: 45, minimum_hours: 2, fuel_surcharge_pct: 5, congestion_charge: 15, stair_charge_per_flight: 25, packing_rate_per_hour: 35 });
        setBooking(config.booking_settings || { min_notice_hours: 24, max_advance_days: 90, deposit_required: true, deposit_pct: 25 });
      } else {
        await supabase.from('company_config').insert({ company_id: co.id });
      }

      // Check email connection
      try {
        const res = await fetch(`/api/email/status?company_id=${co.id}`);
        const data = await res.json();
        setEmailConnected(data.connected);
        setEmailAddress(data.email_address);
      } catch (err) {
        console.error('Failed to check email status:', err);
      }
      setEmailLoading(false);

      setLoading(false);
    })();
  }, [user]);

  // Load team members
  useEffect(() => {
    if (!companyId || section !== 'team') return;
    setTeamLoading(true);
    (async () => {
      const { data } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      setTeamMembers(data || []);
      setTeamLoading(false);
    })();
  }, [companyId, section]);

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

  const disconnectEmail = async () => {
    if (!companyId) return;
    if (!confirm('Disconnect Gmail? Confirmation emails will stop sending.')) return;
    try {
      await fetch(`/api/email/status?company_id=${companyId}`, { method: 'DELETE' });
      setEmailConnected(false);
      setEmailAddress(null);
    } catch (err) {
      console.error('Failed to disconnect email:', err);
    }
  };

  const inviteTeamMember = async () => {
    if (!companyId || !inviteEmail.trim()) return;
    const { error } = await supabase.from('company_users').insert({
      company_id: companyId,
      email: inviteEmail.trim().toLowerCase(),
      full_name: inviteName.trim() || null,
      role: inviteRole,
      status: 'invited',
    });
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setInviteEmail('');
      setInviteName('');
      setShowInviteForm(false);
      // Refresh
      const { data } = await supabase.from('company_users').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      setTeamMembers(data || []);
    }
  };

  const removeTeamMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name || 'this member'} from the team?`)) return;
    await supabase.from('company_users').delete().eq('id', id);
    setTeamMembers(prev => prev.filter(m => m.id !== id));
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

  if (!user || !company) return null;

  const sections: { key: SettingsSection; label: string; icon: string; group: string }[] = [
    { key: 'company', label: 'Company Info', icon: '🏢', group: 'General' },
    { key: 'team', label: 'Team', icon: '👥', group: 'General' },
    { key: 'billing', label: 'Billing', icon: '💳', group: 'General' },
    { key: 'fleet', label: 'Fleet', icon: '🚛', group: 'Configuration' },
    { key: 'hours', label: 'Working Hours', icon: '🕐', group: 'Configuration' },
    { key: 'areas', label: 'Service Areas', icon: '📍', group: 'Configuration' },
    { key: 'pricing', label: 'Pricing', icon: '💰', group: 'Configuration' },
    { key: 'booking', label: 'Booking Rules', icon: '📋', group: 'Configuration' },
    { key: 'email', label: 'Gmail Connect', icon: '📧', group: 'Integrations' },
    { key: 'calendar', label: 'Calendar Sync', icon: '📅', group: 'Integrations' },
    { key: 'import', label: 'Data Import', icon: '📥', group: 'Integrations' },
  ];

  const groups = ['General', 'Configuration', 'Integrations'];

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
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">{company.name || company.company_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
          {saved && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
        </div>
      </div>

      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar Nav */}
        <div className="w-56 flex-shrink-0 bg-white border-r min-h-[calc(100vh-73px)] py-6 px-3 hidden md:block">
          {groups.map(group => (
            <div key={group} className="mb-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">{group}</p>
              {sections.filter(s => s.group === group).map(s => (
                <button key={s.key} onClick={() => setSection(s.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition mb-0.5 ${
                    section === s.key ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  <span className="text-base">{s.icon}</span>
                  <span>{s.label}</span>
                  {s.key === 'email' && emailConnected && <div className="w-2 h-2 bg-green-500 rounded-full ml-auto" />}
                  {s.key === 'calendar' && calendarEnabled && <div className="w-2 h-2 bg-green-500 rounded-full ml-auto" />}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden w-full px-4 pt-4">
          <select value={section} onChange={e => setSection(e.target.value as SettingsSection)}
            className="w-full px-4 py-3 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white mb-4">
            {sections.map(s => (
              <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 md:px-8 py-6 max-w-3xl">

          {/* ═══════ COMPANY INFO ═══════ */}
          {section === 'company' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Company Information</h2>
                <p className="text-sm text-gray-500">Your business details as shown to customers</p>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Company Name</label>
                    <p className="px-4 py-2.5 bg-gray-50 border rounded-lg text-sm font-medium text-gray-900">{company.name || company.company_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Email</label>
                    <p className="px-4 py-2.5 bg-gray-50 border rounded-lg text-sm font-medium text-gray-900">{company.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Phone</label>
                    <p className="px-4 py-2.5 bg-gray-50 border rounded-lg text-sm font-medium text-gray-900">{company.phone || '—'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Coverage Postcodes</label>
                    <p className="px-4 py-2.5 bg-gray-50 border rounded-lg text-sm font-medium text-gray-900">{company.coverage_postcodes?.join(', ') || 'None set'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ TEAM ═══════ */}
          {section === 'team' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Team Management</h2>
                  <p className="text-sm text-gray-500">{teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowInviteForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
                  + Add Member
                </button>
              </div>

              {showInviteForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-blue-800 text-sm">Add Team Member</h3>
                  <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name"
                    className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" type="email"
                    className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="driver">Driver</option>
                    <option value="porter">Porter</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="surveyor">Surveyor</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={inviteTeamMember} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">Add</button>
                    <button onClick={() => setShowInviteForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
                  </div>
                </div>
              )}

              {teamLoading ? (
                <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Loading team...</div>
              ) : teamMembers.length === 0 ? (
                <div className="bg-white rounded-xl border p-12 text-center">
                  <p className="text-gray-500">No team members yet. Add your first team member to get started.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between px-5 py-4 border-b last:border-0 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 font-bold text-sm">{(member.full_name || member.email || '?')[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{member.full_name || 'No name'}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold capitalize">{member.role}</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>{member.status}</span>
                        <button onClick={() => removeTeamMember(member.id, member.full_name)}
                          className="text-red-400 hover:text-red-600 transition p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ BILLING ═══════ */}
          {section === 'billing' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Billing & Subscription</h2>
                <p className="text-sm text-gray-500">Manage your plan and lead balance</p>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-bold text-gray-900 mb-3">Lead Balance</h3>
                <p className="text-3xl font-bold text-blue-600">£{company.balance?.toFixed(2) || '0.00'}</p>
                <p className="text-sm text-gray-500 mt-1">Used for purchasing leads at £10.00 each</p>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <h3 className="font-bold text-gray-900 mb-3">CRM Subscription</h3>
                {crmActive ? (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <div>
                      <p className="font-semibold text-green-700">CRM Pro — Active</p>
                      <p className="text-sm text-gray-500">£129.99/month • Quotes, Pipeline, Diary, Customers & Reports</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-500 mb-4">Unlock the full CRM suite to manage your removal business.</p>
                    <button className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all">
                      Start CRM Pro — £129.99/month
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ FLEET TAB ═══════ */}
          {section === 'fleet' && (
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
                <div className="grid grid-cols-1 gap-4">
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          {section === 'hours' && (
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
          {section === 'areas' && (
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
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Maximum Radius: {areas.max_radius_miles} miles</label>
                  <input type="range" min="5" max="200" value={areas.max_radius_miles}
                    onChange={e => setAreas({ ...areas, max_radius_miles: parseInt(e.target.value) })}
                    onMouseUp={() => saveConfig('service_areas', areas)}
                    onTouchEnd={() => saveConfig('service_areas', areas)}
                    className="w-full max-w-md h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
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
                        }} className="hover:text-red-900">×</button>
                      </span>
                    ))}
                  </div>
                  <input placeholder="Add postcode to exclude (press Enter)" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase"
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
                </div>
              </div>
            </div>
          )}

          {/* ═══════ PRICING TAB ═══════ */}
          {section === 'pricing' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Pricing Rules</h2>
                <p className="text-sm text-gray-500">Set your base rates and surcharges</p>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[
                    { key: 'hourly_rate', label: 'Hourly Rate', prefix: '£', suffix: '/hr' },
                    { key: 'minimum_hours', label: 'Minimum Hours', prefix: '', suffix: 'hrs' },
                    { key: 'fuel_surcharge_pct', label: 'Fuel Surcharge', prefix: '', suffix: '%' },
                    { key: 'congestion_charge', label: 'Congestion Charge', prefix: '£', suffix: '' },
                    { key: 'stair_charge_per_flight', label: 'Stair Charge', prefix: '£', suffix: '/flight' },
                    { key: 'packing_rate_per_hour', label: 'Packing Rate', prefix: '£', suffix: '/hr' },
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ BOOKING TAB ═══════ */}
          {section === 'booking' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Booking Rules</h2>
                <p className="text-sm text-gray-500">Control notice periods and deposit requirements</p>
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

          {/* ═══════ EMAIL / GMAIL CONNECT ═══════ */}
          {section === 'email' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gmail Integration</h2>
                <p className="text-sm text-gray-500">Connect your Gmail to auto-send confirmation emails to customers</p>
              </div>

              <div className="bg-white rounded-xl border p-6">
                {emailLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Checking connection...
                  </div>
                ) : emailConnected ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <svg className="w-6 h-6" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-green-800 text-sm">Gmail Connected</p>
                        <p className="text-green-600 text-xs">{emailAddress}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p className="flex items-center gap-2">✅ Confirmation emails auto-sent when booking appointments</p>
                      <p className="flex items-center gap-2">✅ Emails sent from your Gmail address</p>
                      <p className="flex items-center gap-2">✅ Professional branded email template</p>
                    </div>

                    <button onClick={disconnectEmail}
                      className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition">
                      Disconnect Gmail
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-5">Connect your Gmail to automatically send confirmation emails to customers when you book appointments. Emails will be sent from your own email address.</p>
                    <div className="space-y-2 text-sm text-gray-500 mb-6 text-left max-w-sm mx-auto">
                      <p className="flex items-center gap-2">📧 Send from your real email address</p>
                      <p className="flex items-center gap-2">📅 Auto-send on appointment booking</p>
                      <p className="flex items-center gap-2">🎨 Professional branded email template</p>
                      <p className="flex items-center gap-2">🔒 Secure OAuth — we never see your password</p>
                    </div>
                    <a href={`/api/auth/gmail/connect?company_id=${companyId}`}
                      className="inline-flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all">
                      <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      <span className="font-semibold text-gray-700">Connect Gmail</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ CALENDAR SYNC ═══════ */}
          {section === 'calendar' && (
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
                      <div className="space-y-2 text-sm text-blue-700">
                        <p><strong>Google Calendar:</strong> Settings → Add calendar → From URL → Paste</p>
                        <p><strong>Apple Calendar:</strong> File → New Calendar Subscription → Paste URL</p>
                        <p><strong>Outlook:</strong> Add calendar → Subscribe from web → Paste URL</p>
                      </div>
                      <p className="text-xs text-blue-500 mt-3">Events sync automatically every 1-12 hours depending on your calendar app.</p>
                    </div>

                    <button onClick={disableCalendarFeed}
                      className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition">
                      Disable calendar feed
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ DATA IMPORT ═══════ */}
          {section === 'import' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Data Import</h2>
                <p className="text-sm text-gray-500">Import customers, quotes, or leads from CSV files</p>
              </div>

              <div className="bg-white rounded-xl border p-6 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">What are you importing?</label>
                  <select value={importType} onChange={e => setImportType(e.target.value)}
                    className="w-full max-w-xs px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="customers">Customers</option>
                    <option value="quotes">Quotes / Jobs</option>
                    <option value="leads">Leads</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Upload CSV File</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition">
                    <input type="file" accept=".csv,.xlsx" onChange={e => setImportFile(e.target.files?.[0] || null)}
                      className="hidden" id="import-file" />
                    <label htmlFor="import-file" className="cursor-pointer">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">📥</span>
                      </div>
                      <p className="text-sm font-medium text-gray-700">{importFile ? importFile.name : 'Click to upload CSV or XLSX'}</p>
                      <p className="text-xs text-gray-400 mt-1">Maximum 10MB</p>
                    </label>
                  </div>
                </div>

                {importType === 'customers' && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Expected columns:</p>
                    <p className="text-xs text-gray-500 font-mono">name, email, phone, address, postcode, notes</p>
                  </div>
                )}
                {importType === 'quotes' && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Expected columns:</p>
                    <p className="text-xs text-gray-500 font-mono">customer_name, email, phone, from_address, to_address, move_date, quote_value, status</p>
                  </div>
                )}
                {importType === 'leads' && (
                  <div className="bg-gray-50 border rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Expected columns:</p>
                    <p className="text-xs text-gray-500 font-mono">name, email, phone, from_postcode, to_postcode, move_date, bedrooms</p>
                  </div>
                )}

                <button onClick={async () => {
                  if (!importFile || !companyId) return alert('Please select a file first');
                  setImportStatus('Importing...');
                  const formData = new FormData();
                  formData.append('file', importFile);
                  formData.append('type', importType);
                  formData.append('company_id', companyId);
                  try {
                    const res = await fetch('/api/import', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.success) {
                      setImportStatus(`✅ Successfully imported ${data.count || 0} ${importType}`);
                      setImportFile(null);
                    } else {
                      setImportStatus(`❌ Import failed: ${data.error || 'Unknown error'}`);
                    }
                  } catch (err) {
                    setImportStatus('❌ Import failed. Please check your file format.');
                  }
                }} disabled={!importFile}
                  className={`px-6 py-2.5 font-semibold rounded-lg text-sm transition ${
                    importFile ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}>
                  Import Data
                </button>

                {importStatus && (
                  <p className={`text-sm font-medium ${importStatus.includes('✅') ? 'text-green-600' : importStatus.includes('❌') ? 'text-red-600' : 'text-gray-500'}`}>
                    {importStatus}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
