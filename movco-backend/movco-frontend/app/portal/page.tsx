'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ═══════════════════════════════════════════════════════════════
//  MOVCO — Internal Admin Portal
//  Route: /admin
//  Manages: Storage Partners, Removals Calculator, Removals CRM
// ═══════════════════════════════════════════════════════════════

// ─── Types ───

type StoragePartner = {
  id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  active: boolean;
  plan: string | null;
  units: any[];
  created_at: string;
};

type RemovalsPartner = {
  id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  active: boolean;
  product_type: 'calculator' | 'crm';
  plan: string | null;
  pricing: any;
  van_types: any[];
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

type AnyPartner = (StoragePartner | RemovalsPartner) & {
  _type: 'storage' | 'calc' | 'crm';
  _leads_count?: number;
  _mrr?: number;
  _extra?: Record<string, any>;
};

// ─── Plan pricing map ───
const PLAN_PRICING: Record<string, number> = {
  trial: 0,
  starter: 29.99,
  pro: 49.99,
  enterprise: 99.99,
  crm_pro: 129.99,
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  crm_pro: 'CRM Pro',
};

// ─── SVG Icon helper ───
function Icon({ d, size = 20, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const icons = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  storage: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  calculator: 'M9 7h6m0 0v6m0-6l-6 6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z',
  monitor: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  billing: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  plus: 'M12 4v16m8-8H4',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  x: 'M6 18L18 6M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
};

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminPortalPage() {
  // ─── State ───
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  const [storagePartners, setStoragePartners] = useState<AnyPartner[]>([]);
  const [calcPartners, setCalcPartners] = useState<AnyPartner[]>([]);
  const [crmPartners, setCrmPartners] = useState<AnyPartner[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState<AnyPartner | null>(null);
  const [addModal, setAddModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState<Record<string, any>>({});

  // ─── Fetch all data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch storage partners + lead counts
      const { data: storageData } = await supabase
        .from('storage_partners')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch storage lead counts
      const { data: storageLeadCounts } = await supabase
        .from('storage_leads')
        .select('partner_id');

      const storageLeadMap: Record<string, number> = {};
      (storageLeadCounts || []).forEach((l: any) => {
        storageLeadMap[l.partner_id] = (storageLeadMap[l.partner_id] || 0) + 1;
      });

      const mappedStorage: AnyPartner[] = (storageData || []).map((p: any) => ({
        ...p,
        _type: 'storage' as const,
        _leads_count: storageLeadMap[p.id] || 0,
        _mrr: p.active ? (PLAN_PRICING[p.plan] || 0) : 0,
        _extra: { units_count: Array.isArray(p.units) ? p.units.length : 0 },
      }));

      // Fetch removals partners + lead counts
      const { data: removalsData } = await supabase
        .from('removals_partners')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: removalsLeadCounts } = await supabase
        .from('removals_leads')
        .select('partner_id');

      const removalsLeadMap: Record<string, number> = {};
      (removalsLeadCounts || []).forEach((l: any) => {
        removalsLeadMap[l.partner_id] = (removalsLeadMap[l.partner_id] || 0) + 1;
      });

      const mappedCalc: AnyPartner[] = [];
      const mappedCrm: AnyPartner[] = [];

      (removalsData || []).forEach((p: any) => {
        const partner: AnyPartner = {
          ...p,
          _type: p.product_type === 'crm' ? ('crm' as const) : ('calc' as const),
          _leads_count: removalsLeadMap[p.id] || 0,
          _mrr: p.active ? (PLAN_PRICING[p.plan] || 0) : 0,
          _extra: {
            van_count: Array.isArray(p.van_types) ? p.van_types.length : 0,
          },
        };
        if (p.product_type === 'crm') {
          mappedCrm.push(partner);
        } else {
          mappedCalc.push(partner);
        }
      });

      setStoragePartners(mappedStorage);
      setCalcPartners(mappedCalc);
      setCrmPartners(mappedCrm);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Toggle active status ───
  const toggleActive = async (partner: AnyPartner) => {
    const table = partner._type === 'storage' ? 'storage_partners' : 'removals_partners';
    const newActive = !partner.active;

    await supabase.from(table).update({ active: newActive }).eq('id', partner.id);
    fetchData();
  };

  // ─── Save edit ───
  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);

    const table = editModal._type === 'storage' ? 'storage_partners' : 'removals_partners';

    const updateData: Record<string, any> = {
      company_name: formData.company_name,
      slug: formData.slug,
      email: formData.email || null,
      phone: formData.phone || null,
      primary_color: formData.primary_color,
      plan: formData.plan,
      website: formData.website || null,
    };

    await supabase.from(table).update(updateData).eq('id', editModal.id);

    setSaving(false);
    setEditModal(null);
    fetchData();
  };

  // ─── Add new partner ───
  const addPartner = async () => {
    if (!addModal) return;
    setSaving(true);

    if (addModal === 'storage') {
      await supabase.from('storage_partners').insert({
        company_name: formData.company_name,
        slug: formData.slug,
        email: formData.email || null,
        phone: formData.phone || null,
        primary_color: formData.primary_color || '2563EB',
        plan: formData.plan || 'trial',
        active: true,
        units: [],
      });
    } else {
      // removals — calc or crm
      await supabase.from('removals_partners').insert({
        company_name: formData.company_name,
        slug: formData.slug,
        email: formData.email || null,
        phone: formData.phone || null,
        primary_color: formData.primary_color || '2563EB',
        plan: addModal === 'crm' ? 'crm_pro' : (formData.plan || 'trial'),
        product_type: addModal === 'crm' ? 'crm' : 'calculator',
        active: true,
      });
    }

    setSaving(false);
    setAddModal(null);
    setFormData({});
    fetchData();
  };

  // ─── Open edit modal ───
  const openEdit = (partner: AnyPartner) => {
    setFormData({
      company_name: partner.company_name,
      slug: partner.slug,
      email: partner.email || '',
      phone: partner.phone || '',
      primary_color: partner.primary_color,
      plan: partner.plan || 'trial',
      website: (partner as any).website || '',
    });
    setEditModal(partner);
  };

  // ─── Open add modal ───
  const openAdd = (type: string) => {
    setFormData({
      company_name: '',
      slug: '',
      email: '',
      phone: '',
      primary_color: '2563EB',
      plan: type === 'crm' ? 'crm_pro' : 'trial',
      website: '',
    });
    setAddModal(type);
  };

  // ─── Stats ───
  const allPartners = [...storagePartners, ...calcPartners, ...crmPartners];
  const activePartners = allPartners.filter((p) => p.active);
  const totalMRR = allPartners.reduce((s, p) => s + (p._mrr || 0), 0);
  const totalLeads = allPartners.reduce((s, p) => s + (p._leads_count || 0), 0);
  const storageActive = storagePartners.filter((p) => p.active).length;
  const calcActive = calcPartners.filter((p) => p.active).length;
  const crmActive = crmPartners.filter((p) => p.active).length;

  // ─── Colors ───
  const c = {
    sidebar: '#0F1629',
    sidebarHover: '#1A2342',
    sidebarActive: '#2563EB',
    surface: '#FFFFFF',
    surfaceAlt: '#F8F9FC',
    border: '#E8EBF0',
    text: '#111827',
    textMuted: '#6B7280',
    textLight: '#9CA3AF',
    accent: '#2563EB',
    accentLight: '#EFF4FF',
    green: '#059669',
    greenLight: '#ECFDF5',
    amber: '#D97706',
    amberLight: '#FFFBEB',
    red: '#DC2626',
    redLight: '#FEF2F2',
  };

  const planColors: Record<string, { bg: string; text: string }> = {
    trial: { bg: c.amberLight, text: c.amber },
    starter: { bg: c.accentLight, text: c.accent },
    pro: { bg: '#F0FDF4', text: '#16A34A' },
    enterprise: { bg: '#F5F3FF', text: '#7C3AED' },
    crm_pro: { bg: '#F0FDF4', text: '#16A34A' },
  };

  // ─── Nav items ───
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: icons.dashboard },
    { id: 'divider1', type: 'divider' as const, label: 'STORAGE' },
    { id: 'storage', label: 'Storage Partners', icon: icons.storage, badge: storageActive },
    { id: 'divider2', type: 'divider' as const, label: 'REMOVALS' },
    { id: 'removals_calc', label: 'Calculator Partners', icon: icons.calculator, badge: calcActive },
    { id: 'removals_crm', label: 'CRM Partners', icon: icons.monitor, badge: crmActive },
    { id: 'divider3', type: 'divider' as const, label: 'FINANCE' },
    { id: 'billing', label: 'Billing & Plans', icon: icons.billing },
  ];

  // ═══════════════════════════════════════════
  //  PARTNER TABLE
  // ═══════════════════════════════════════════
  const PartnerTable = ({
    partners,
    type,
    title,
    subtitle,
    extraColumns = [],
  }: {
    partners: AnyPartner[];
    type: string;
    title: string;
    subtitle: string;
    extraColumns?: { key: string; header: string; render?: (p: AnyPartner) => string }[];
  }) => {
    const filtered = searchTerm
      ? partners.filter(
          (p) =>
            p.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.slug?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : partners;

    return (
      <div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <button
            onClick={() => openAdd(type)}
            className="flex items-center gap-2 bg-blue-600 text-white border-none rounded-lg px-5 py-2.5 text-sm font-semibold cursor-pointer hover:bg-blue-700 transition"
          >
            <Icon d={icons.plus} size={16} color="#fff" /> Add Partner
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40">
            <Icon d={icons.search} size={16} />
          </div>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search partners..."
            className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">MRR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Leads</th>
                {extraColumns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">{col.header}</th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const plan = planColors[p.plan || 'trial'] || planColors.trial;
                return (
                  <tr key={p.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${i === 0 ? 'border-t-0' : ''}`}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: `#${p.primary_color}15`, color: `#${p.primary_color}` }}
                        >
                          {p.company_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{p.company_name}</div>
                          <div className="text-xs text-gray-400">{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${p.active ? 'text-emerald-600' : 'text-red-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-md"
                        style={{ backgroundColor: plan.bg, color: plan.text }}
                      >
                        {PLAN_LABELS[p.plan || 'trial'] || 'Trial'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold">
                      {(p._mrr || 0) > 0 ? `£${(p._mrr || 0).toFixed(2)}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right">{p._leads_count || 0}</td>
                    {extraColumns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5 text-right">
                        {col.render ? col.render(p) : (p._extra?.[col.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => openEdit(p)}
                          className="bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition flex items-center gap-1"
                        >
                          <Icon d={icons.edit} size={12} /> Edit
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          className={`border-none rounded-md px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${
                            p.active
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {p.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5 + extraColumns.length + 1} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No partners found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  //  MODAL
  // ═══════════════════════════════════════════
  const Modal = ({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-7 max-w-lg w-[90%] max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="bg-gray-100 border-none rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition">
            <Icon d={icons.x} size={16} color="#6B7280" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  //  LOADING
  // ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: c.surfaceAlt }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ─── SIDEBAR ─── */}
      <aside className="w-60 flex-shrink-0 sticky top-0 h-screen flex flex-col" style={{ background: c.sidebar, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo */}
        <div className="px-5 pt-5 pb-6 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-sm text-white" style={{ background: 'linear-gradient(135deg, #2563EB, #7C3AED)' }}>
            M
          </div>
          <div>
            <div className="text-white font-bold text-base tracking-tight">MOVCO</div>
            <div className="text-white/40 text-[10px] font-medium">Admin Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 overflow-y-auto">
          {navItems.map((item) => {
            if (item.type === 'divider') {
              return (
                <div key={item.id} className="text-[10px] font-semibold text-white/25 tracking-widest uppercase px-2.5 pt-5 pb-2">
                  {item.label}
                </div>
              );
            }
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); setSearchTerm(''); }}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border-none cursor-pointer text-left mb-0.5 transition-all"
                style={{
                  background: isActive ? c.sidebarActive : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                }}
                onMouseOver={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = c.sidebarHover;
                }}
                onMouseOut={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <Icon d={item.icon!} size={18} color={isActive ? '#fff' : 'rgba(255,255,255,0.45)'} />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer stats */}
        <div className="p-4 border-t border-white/5">
          <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15))' }}>
            <div className="text-xs font-semibold text-white/85">{activePartners.length} active partners</div>
            <div className="text-[10px] text-white/40">£{totalMRR.toFixed(2)}/mo MRR</div>
          </div>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main className="flex-1 p-7 min-w-0 overflow-x-hidden">
        {/* Refresh button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition cursor-pointer bg-transparent border-none"
          >
            <Icon d={icons.refresh} size={14} /> Refresh
          </button>
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {page === 'dashboard' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Dashboard</h1>
            <p className="text-sm text-gray-500 mb-7">Overview of all MOVCO partner activity</p>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3.5 mb-7">
              {[
                { label: 'Total Partners', value: allPartners.length, sub: `${activePartners.length} active`, color: c.accent },
                { label: 'Monthly Revenue', value: `£${totalMRR.toFixed(2)}`, sub: `${allPartners.filter((p) => (p._mrr || 0) > 0).length} paying`, color: c.green },
                { label: 'Total Leads', value: totalLeads, sub: 'All time', color: c.amber },
                { label: 'ARR', value: `£${(totalMRR * 12).toFixed(0)}`, sub: 'Projected annual', color: '#7C3AED' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{kpi.label}</div>
                  <div className="text-3xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'DM Mono', monospace" }}>{kpi.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Segment cards */}
            <div className="grid grid-cols-3 gap-3.5 mb-7">
              {[
                {
                  title: 'Storage Partners', icon: icons.storage, color: '#2563EB',
                  active: storageActive, total: storagePartners.length,
                  mrr: storagePartners.reduce((s, p) => s + (p._mrr || 0), 0),
                  leads: storagePartners.reduce((s, p) => s + (p._leads_count || 0), 0),
                  nav: 'storage',
                },
                {
                  title: 'Removals — Calculator', icon: icons.calculator, color: '#0F766E',
                  active: calcActive, total: calcPartners.length,
                  mrr: calcPartners.reduce((s, p) => s + (p._mrr || 0), 0),
                  leads: calcPartners.reduce((s, p) => s + (p._leads_count || 0), 0),
                  nav: 'removals_calc',
                },
                {
                  title: 'Removals — CRM', icon: icons.monitor, color: '#7C3AED',
                  active: crmActive, total: crmPartners.length,
                  mrr: crmPartners.reduce((s, p) => s + (p._mrr || 0), 0),
                  leads: crmPartners.reduce((s, p) => s + (p._leads_count || 0), 0),
                  nav: 'removals_crm',
                },
              ].map((seg) => (
                <button
                  key={seg.title}
                  onClick={() => setPage(seg.nav)}
                  className="bg-white rounded-xl p-5 border border-gray-200 cursor-pointer text-left hover:shadow-md transition-all"
                  style={{ fontFamily: 'inherit' }}
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${seg.color}12` }}>
                      <Icon d={seg.icon} size={18} color={seg.color} />
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{seg.title}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xl font-bold text-gray-900" style={{ fontFamily: "'DM Mono', monospace" }}>
                        {seg.active}<span className="text-sm font-medium text-gray-400">/{seg.total}</span>
                      </div>
                      <div className="text-[11px] text-gray-400">Active</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>£{seg.mrr.toFixed(0)}</div>
                      <div className="text-[11px] text-gray-400">MRR</div>
                    </div>
                  </div>
                  <div className="mt-3.5 pt-3.5 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                    <span>{seg.leads} leads</span>
                    <span style={{ color: seg.color, fontWeight: 600 }}>View →</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Recent partners */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Recently Added Partners</h3>
              <div className="space-y-1">
                {[...allPartners]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 6)
                  .map((p) => {
                    const typeLabel = p._type === 'storage' ? 'Storage' : p._type === 'calc' ? 'Removals Calc' : 'Removals CRM';
                    const typeColor = p._type === 'storage' ? '#2563EB' : p._type === 'calc' ? '#0F766E' : '#7C3AED';
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0"
                          style={{ background: `#${p.primary_color}12`, color: `#${p.primary_color}` }}
                        >
                          {p.company_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{p.company_name}</div>
                          <div className="text-[11px] text-gray-400 truncate">{p.email}</div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: `${typeColor}10`, color: typeColor }}>
                          {typeLabel}
                        </span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STORAGE ═══ */}
        {page === 'storage' && (
          <PartnerTable
            partners={storagePartners}
            type="storage"
            title="Storage Partners"
            subtitle={`${storageActive} active · ${storagePartners.length} total · White-label storage calculators`}
            extraColumns={[{ key: 'units_count', header: 'Units' }]}
          />
        )}

        {/* ═══ REMOVALS CALC ═══ */}
        {page === 'removals_calc' && (
          <PartnerTable
            partners={calcPartners}
            type="calc"
            title="Removals — Calculator"
            subtitle={`${calcActive} active · ${calcPartners.length} total · White-label removals quote tools`}
            extraColumns={[{ key: 'van_count', header: 'Vans' }]}
          />
        )}

        {/* ═══ REMOVALS CRM ═══ */}
        {page === 'removals_crm' && (
          <PartnerTable
            partners={crmPartners}
            type="crm"
            title="Removals — CRM"
            subtitle={`${crmActive} active · ${crmPartners.length} total · Full CRM at £129.99/mo`}
            extraColumns={[]}
          />
        )}

        {/* ═══ BILLING ═══ */}
        {page === 'billing' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Billing & Plans</h1>
            <p className="text-sm text-gray-500 mb-7">Subscription overview and revenue breakdown</p>

            {/* Revenue KPIs */}
            <div className="grid grid-cols-3 gap-3.5 mb-7">
              {[
                { label: 'Monthly Recurring Revenue', value: `£${totalMRR.toFixed(2)}`, color: c.green },
                { label: 'Annual Run Rate', value: `£${(totalMRR * 12).toFixed(0)}`, color: c.accent },
                { label: 'Paying Partners', value: `${allPartners.filter((p) => (p._mrr || 0) > 0).length} / ${allPartners.length}`, color: '#7C3AED' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="text-xs font-semibold text-gray-500 mb-2">{kpi.label}</div>
                  <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color, fontFamily: "'DM Mono', monospace" }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Revenue by plan */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 mb-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Revenue by Plan</h3>
              {[
                { plan: 'CRM Pro', price: '£129.99/mo', count: crmPartners.filter((p) => p.active && (p._mrr || 0) > 0).length, mrr: crmPartners.reduce((s, p) => s + (p._mrr || 0), 0), color: '#7C3AED' },
                { plan: 'Pro (Calculator)', price: '£49.99/mo', count: [...storagePartners, ...calcPartners].filter((p) => p.plan === 'pro' && (p._mrr || 0) > 0).length, mrr: [...storagePartners, ...calcPartners].filter((p) => p.plan === 'pro').reduce((s, p) => s + (p._mrr || 0), 0), color: '#16A34A' },
                { plan: 'Starter', price: '£29.99/mo', count: [...storagePartners, ...calcPartners].filter((p) => p.plan === 'starter' && (p._mrr || 0) > 0).length, mrr: [...storagePartners, ...calcPartners].filter((p) => p.plan === 'starter').reduce((s, p) => s + (p._mrr || 0), 0), color: c.accent },
                { plan: 'Trial', price: 'Free', count: allPartners.filter((p) => p.plan === 'trial').length, mrr: 0, color: c.amber },
              ].map((row) => (
                <div key={row.plan} className="flex items-center py-3.5 border-b border-gray-100 last:border-b-0">
                  <span className="w-2.5 h-2.5 rounded-full mr-3.5 flex-shrink-0" style={{ background: row.color }} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{row.plan}</div>
                    <div className="text-xs text-gray-400">{row.price} · {row.count} partner{row.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-base font-bold" style={{ color: row.mrr > 0 ? c.text : c.textLight, fontFamily: "'DM Mono', monospace" }}>
                    {row.mrr > 0 ? `£${row.mrr.toFixed(2)}` : '£0'}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-4 mt-1">
                <span className="text-sm font-bold text-gray-900">Total MRR</span>
                <span className="text-lg font-bold text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>£{totalMRR.toFixed(2)}</span>
              </div>
            </div>

            {/* All subscriptions */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">All Subscriptions</h3>
              </div>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">MRR</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {allPartners
                    .filter((p) => (p._mrr || 0) > 0)
                    .sort((a, b) => (b._mrr || 0) - (a._mrr || 0))
                    .map((p, i) => {
                      const typeLabel = p._type === 'storage' ? 'Storage' : p._type === 'calc' ? 'Removals Calc' : 'Removals CRM';
                      return (
                        <tr key={p.id} className={`hover:bg-gray-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                          <td className="px-4 py-3 font-medium">{p.company_name}</td>
                          <td className="px-4 py-3 text-gray-500">{typeLabel}</td>
                          <td className="px-4 py-3">
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-md"
                              style={{
                                background: (planColors[p.plan || 'trial'] || planColors.trial).bg,
                                color: (planColors[p.plan || 'trial'] || planColors.trial).text,
                              }}
                            >
                              {PLAN_LABELS[p.plan || 'trial'] || 'Trial'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>£{(p._mrr || 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ═══ EDIT MODAL ═══ */}
      {editModal && (
        <Modal title={`Edit — ${editModal.company_name}`} onClose={() => setEditModal(null)}>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Company Name</label>
              <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" value={formData.company_name || ''} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Slug</label>
              <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" value={formData.slug || ''} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Brand Colour</label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-gray-200" style={{ background: `#${formData.primary_color || '2563EB'}` }} />
                  <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" value={formData.primary_color || ''} onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Plan</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition bg-white"
                  value={formData.plan || 'trial'}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                >
                  <option value="trial">Trial</option>
                  <option value="starter">Starter — £29.99/mo</option>
                  <option value="pro">Pro — £49.99/mo</option>
                  <option value="enterprise">Enterprise — £99.99/mo</option>
                  {editModal._type === 'crm' && <option value="crm_pro">CRM Pro — £129.99/mo</option>}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Website</label>
              <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" value={formData.website || ''} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="flex gap-2.5 mt-6">
            <button onClick={() => setEditModal(null)} className="flex-1 bg-gray-100 border border-gray-200 rounded-lg py-2.5 text-sm font-semibold text-gray-500 cursor-pointer hover:bg-gray-200 transition">
              Cancel
            </button>
            <button onClick={saveEdit} disabled={saving} className="flex-1 bg-blue-600 text-white border-none rounded-lg py-2.5 text-sm font-semibold cursor-pointer hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ═══ ADD MODAL ═══ */}
      {addModal && (
        <Modal
          title={`Add New ${addModal === 'storage' ? 'Storage' : addModal === 'calc' ? 'Removals Calculator' : 'Removals CRM'} Partner`}
          onClose={() => { setAddModal(null); setFormData({}); }}
        >
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Company Name</label>
              <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" placeholder="e.g. SecureBox Manchester" value={formData.company_name || ''} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Slug (URL path)</label>
              <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" placeholder="e.g. securebox-manchester" value={formData.slug || ''} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" placeholder="info@company.co.uk" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
                <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" placeholder="01234 567 890" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Brand Colour (hex)</label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-gray-200" style={{ background: `#${formData.primary_color || '2563EB'}` }} />
                  <input className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition" placeholder="2563EB" value={formData.primary_color || ''} onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Plan</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 transition bg-white"
                  value={formData.plan || 'trial'}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                >
                  <option value="trial">Trial</option>
                  <option value="starter">Starter — £29.99/mo</option>
                  <option value="pro">Pro — £49.99/mo</option>
                  {addModal === 'crm' && <option value="crm_pro">CRM Pro — £129.99/mo</option>}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2.5 mt-6">
            <button onClick={() => { setAddModal(null); setFormData({}); }} className="flex-1 bg-gray-100 border border-gray-200 rounded-lg py-2.5 text-sm font-semibold text-gray-500 cursor-pointer hover:bg-gray-200 transition">
              Cancel
            </button>
            <button onClick={addPartner} disabled={saving || !formData.company_name || !formData.slug} className="flex-1 bg-blue-600 text-white border-none rounded-lg py-2.5 text-sm font-semibold cursor-pointer hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Partner'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
