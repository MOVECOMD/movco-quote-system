'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// ============================================
// TYPES
// ============================================

type Tab = 'leads' | 'pipeline' | 'diary' | 'customers' | 'reports' | 'settings';

type Company = {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  coverage_postcodes: string[];
  stripe_customer_id: string | null;
};

type Lead = {
  id: string;
  quote_id: string;
  status: string;
  price: number;
  created_at: string;
  instant_quotes: {
    starting_address: string;
    ending_address: string;
    photo_urls: string[] | null;
    ai_analysis: any;
  } | null;
};

type PipelineStage = {
  id: string;
  name: string;
  color: string;
  position: number;
};

type Deal = {
  id: string;
  stage_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  moving_from: string | null;
  moving_to: string | null;
  moving_date: string | null;
  estimated_value: number | null;
  notes: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  total_jobs: number;
  total_revenue: number;
  created_at: string;
};

type DiaryEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  event_type: string;
  customer_name: string | null;
  location: string | null;
  color: string;
  completed: boolean;
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function CompanyDashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // CRM subscription state
  const [crmActive, setCrmActive] = useState(false);
  const [crmLoading, setCrmLoading] = useState(true);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);

  // Pipeline state
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  // Diary state
  const [events, setEvents] = useState<DiaryEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

  // Modal states
  const [showDealModal, setShowDealModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingEvent, setEditingEvent] = useState<DiaryEvent | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth');
  }, [user, authLoading, router]);

  // Show CRM activation success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('crm') === 'activated') {
      alert('🎉 CRM Pro activated! You now have full access to all CRM features.');
      window.history.replaceState({}, '', '/company-dashboard');
      setCrmActive(true);
    }
  }, []);

  // Load company data
  useEffect(() => {
    async function loadData() {
      if (!user) return;

      // Get company
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!companyData) {
        setLoading(false);
        return;
      }

      setCompany(companyData as Company);

      // Check CRM subscription
      const { data: subData } = await supabase
        .from('crm_subscriptions')
        .select('*')
        .eq('company_id', companyData.id)
        .eq('status', 'active')
        .maybeSingle();

      setCrmActive(!!subData);
      setCrmLoading(false);

      // Load leads
      const { data: leadsData } = await supabase
        .from('company_leads')
        .select('*, instant_quotes(*)')
        .eq('company_id', companyData.id)
        .order('created_at', { ascending: false });

      if (leadsData) setLeads(leadsData as Lead[]);

      // Load CRM data if active
      if (subData) {
        await loadCRMData(companyData.id);
      }

      setLoading(false);
    }

    if (user) loadData();
  }, [user]);

  const loadCRMData = async (companyId: string) => {
    // Pipeline stages
    const { data: stagesData } = await supabase
      .from('crm_pipeline_stages')
      .select('*')
      .eq('company_id', companyId)
      .order('position');

    if (stagesData && stagesData.length > 0) {
      setStages(stagesData as PipelineStage[]);
    }

    // Deals
    const { data: dealsData } = await supabase
      .from('crm_deals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (dealsData) setDeals(dealsData as Deal[]);

    // Diary events
    const { data: eventsData } = await supabase
      .from('crm_diary_events')
      .select('*')
      .eq('company_id', companyId)
      .order('start_time');

    if (eventsData) setEvents(eventsData as DiaryEvent[]);

    // Customers
    const { data: customersData } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (customersData) setCustomers(customersData as Customer[]);
  };

  // ============================================
  // CRM ACTIONS
  // ============================================

  const startCrmSubscription = async () => {
    if (!company) return;
    try {
      const res = await fetch('/api/stripe/create-crm-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          company_email: company.email,
          company_name: company.name,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('CRM subscription error:', err);
      alert('Something went wrong. Please try again.');
    }
  };

  // Deal CRUD
  const saveDeal = async (deal: Partial<Deal>) => {
    if (!company) return;
    if (editingDeal) {
      const { error } = await supabase
        .from('crm_deals')
        .update({ ...deal, updated_at: new Date().toISOString() })
        .eq('id', editingDeal.id);
      if (!error) {
        setDeals((prev) => prev.map((d) => (d.id === editingDeal.id ? { ...d, ...deal } as Deal : d)));
      }
    } else {
      const { data, error } = await supabase
        .from('crm_deals')
        .insert({ ...deal, company_id: company.id })
        .select()
        .single();
      if (!error && data) {
        setDeals((prev) => [data as Deal, ...prev]);
      }
    }
    setShowDealModal(false);
    setEditingDeal(null);
  };

  const deleteDeal = async (dealId: string) => {
    if (!confirm('Delete this deal?')) return;
    const { error } = await supabase.from('crm_deals').delete().eq('id', dealId);
    if (!error) setDeals((prev) => prev.filter((d) => d.id !== dealId));
  };

  const moveDeal = async (dealId: string, newStageId: string) => {
    const { error } = await supabase
      .from('crm_deals')
      .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
      .eq('id', dealId);
    if (!error) {
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)));
    }
  };

  // Event CRUD
  const saveEvent = async (event: Partial<DiaryEvent>) => {
    if (!company) return;
    if (editingEvent) {
      const { error } = await supabase
        .from('crm_diary_events')
        .update(event)
        .eq('id', editingEvent.id);
      if (!error) {
        setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, ...event } as DiaryEvent : e)));
      }
    } else {
      const { data, error } = await supabase
        .from('crm_diary_events')
        .insert({ ...event, company_id: company.id })
        .select()
        .single();
      if (!error && data) {
        setEvents((prev) => [...prev, data as DiaryEvent]);
      }
    }
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    const { error } = await supabase.from('crm_diary_events').delete().eq('id', eventId);
    if (!error) setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const toggleEventComplete = async (eventId: string, completed: boolean) => {
    const { error } = await supabase
      .from('crm_diary_events')
      .update({ completed })
      .eq('id', eventId);
    if (!error) {
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, completed } : e)));
    }
  };

  // Customer CRUD
  const saveCustomer = async (customer: Partial<Customer>) => {
    if (!company) return;
    if (editingCustomer) {
      const { error } = await supabase
        .from('crm_customers')
        .update({ ...customer, updated_at: new Date().toISOString() })
        .eq('id', editingCustomer.id);
      if (!error) {
        setCustomers((prev) => prev.map((c) => (c.id === editingCustomer.id ? { ...c, ...customer } as Customer : c)));
      }
    } else {
      const { data, error } = await supabase
        .from('crm_customers')
        .insert({ ...customer, company_id: company.id })
        .select()
        .single();
      if (!error && data) {
        setCustomers((prev) => [data as Customer, ...prev]);
      }
    }
    setShowCustomerModal(false);
    setEditingCustomer(null);
  };

  const deleteCustomer = async (customerId: string) => {
    if (!confirm('Delete this customer?')) return;
    const { error } = await supabase.from('crm_customers').delete().eq('id', customerId);
    if (!error) setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  };

  // ============================================
  // LOADING / AUTH GUARD
  // ============================================

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-700 font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!user || !company) return null;

  const crmTabs: Tab[] = ['pipeline', 'diary', 'customers', 'reports'];
  const isCrmTab = crmTabs.includes(activeTab);

  // ============================================
  // NAV ITEMS CONFIG
  // ============================================

  const navItems: { tab: Tab; label: string; icon: string; crm: boolean }[] = [
    { tab: 'leads', label: 'Leads', icon: 'inbox', crm: false },
    { tab: 'pipeline', label: 'Pipeline', icon: 'pipeline', crm: true },
    { tab: 'diary', label: 'Diary', icon: 'calendar', crm: true },
    { tab: 'customers', label: 'Customers', icon: 'users', crm: true },
    { tab: 'reports', label: 'Reports', icon: 'chart', crm: true },
    { tab: 'settings', label: 'Settings', icon: 'settings', crm: false },
  ];

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ==================== SIDEBAR ==================== */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0a0f1c] text-white flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Image src="/movco-logo.png" alt="MOVCO" width={36} height={36} className="rounded-lg" />
            <div>
              <h1 className="font-bold text-lg tracking-wide">MOVCO</h1>
              <p className="text-xs text-gray-400 truncate">{company.name}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                activeTab === item.tab
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <NavIcon name={item.icon} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.crm && !crmActive && (
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </nav>

        {/* Subscription badge */}
        <div className="p-4 border-t border-white/10">
          {crmActive ? (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-semibold">CRM Pro Active</span>
              </div>
            </div>
          ) : (
            <button
              onClick={startCrmSubscription}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold px-4 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg"
            >
              Unlock CRM — £129.99/mo
            </button>
          )}
        </div>

        {/* Sign out */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={async () => { await signOut(); router.push('/auth'); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-white text-sm transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 min-h-screen overflow-hidden">
        {/* Top bar (mobile) */}
        <div className="lg:hidden flex items-center justify-between bg-white border-b px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-gray-800">MOVCO</span>
          <div className="w-10" />
        </div>

        <div className="p-4 md:p-8 overflow-auto h-[calc(100vh-56px)] lg:h-screen">
          {/* CRM LOCK OVERLAY */}
          {isCrmTab && !crmActive && !crmLoading && (
            <CRMLockOverlay tab={activeTab} onSubscribe={startCrmSubscription} />
          )}

          {/* Tab content — rendered behind overlay if locked */}
          <div className={isCrmTab && !crmActive ? 'filter blur-sm pointer-events-none select-none' : ''}>
            {activeTab === 'leads' && <LeadsTab leads={leads} company={company} />}
            {activeTab === 'pipeline' && (
              <PipelineTab
                stages={stages}
                deals={deals}
                onMoveDeal={moveDeal}
                onAddDeal={() => { setEditingDeal(null); setShowDealModal(true); }}
                onEditDeal={(deal) => { setEditingDeal(deal); setShowDealModal(true); }}
                onDeleteDeal={deleteDeal}
              />
            )}
            {activeTab === 'diary' && (
              <DiaryTab
                events={events}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onAddEvent={() => { setEditingEvent(null); setShowEventModal(true); }}
                onEditEvent={(event) => { setEditingEvent(event); setShowEventModal(true); }}
                onDeleteEvent={deleteEvent}
                onToggleComplete={toggleEventComplete}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersTab
                customers={customers}
                search={customerSearch}
                onSearchChange={setCustomerSearch}
                onAddCustomer={() => { setEditingCustomer(null); setShowCustomerModal(true); }}
                onEditCustomer={(customer) => { setEditingCustomer(customer); setShowCustomerModal(true); }}
                onDeleteCustomer={deleteCustomer}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsTab leads={leads} deals={deals} customers={customers} events={events} company={company} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab company={company} crmActive={crmActive} onSubscribe={startCrmSubscription} />
            )}
          </div>
        </div>
      </main>

      {/* ==================== MODALS ==================== */}
      {showDealModal && (
        <DealModal
          deal={editingDeal}
          stages={stages}
          onSave={saveDeal}
          onClose={() => { setShowDealModal(false); setEditingDeal(null); }}
        />
      )}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          onSave={saveEvent}
          onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
        />
      )}
      {showCustomerModal && (
        <CustomerModal
          customer={editingCustomer}
          onSave={saveCustomer}
          onClose={() => { setShowCustomerModal(false); setEditingCustomer(null); }}
        />
      )}
    </div>
  );
}

// ============================================
// NAV ICON COMPONENT
// ============================================

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    inbox: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    ),
    pipeline: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  };
  return icons[name] || null;
}

// ============================================
// CRM LOCK OVERLAY
// ============================================

function CRMLockOverlay({ tab, onSubscribe }: { tab: Tab; onSubscribe: () => void }) {
  const features: Record<string, { title: string; bullets: string[] }> = {
    pipeline: {
      title: 'Pipeline Management',
      bullets: ['Kanban drag & drop board', 'Track deals from lead to completion', 'Custom stages & deal values', 'Never lose track of a job'],
    },
    diary: {
      title: 'Diary & Scheduling',
      bullets: ['Calendar view of all jobs', 'Schedule surveys & callbacks', 'Track job completion', 'Never double-book again'],
    },
    customers: {
      title: 'Customer Database',
      bullets: ['Searchable customer records', 'Contact details & notes', 'Job history & revenue tracking', 'Build lasting relationships'],
    },
    reports: {
      title: 'Reports & Analytics',
      bullets: ['Revenue tracking & trends', 'Lead conversion rates', 'Pipeline performance', 'Data-driven decisions'],
    },
  };

  const feature = features[tab] || features.pipeline;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4" style={{ position: 'relative', marginBottom: '-100%' }}>
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unlock {feature.title}</h2>
          <p className="text-gray-500 mb-6 text-sm">Get the full MOVCO CRM to manage your removal business like a pro.</p>

          <div className="bg-gradient-to-br from-[#0a0f1c] to-blue-900 rounded-xl p-5 text-white mb-6">
            <p className="text-sm font-medium text-blue-300 mb-1">CRM Pro</p>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-4xl font-bold">£129.99</span>
              <span className="text-blue-300 text-sm">/month</span>
            </div>
            <p className="text-blue-200 text-xs">Cancel anytime • All features included</p>
          </div>

          <div className="text-left space-y-2.5 mb-6">
            {feature.bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onSubscribe}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg text-lg"
          >
            Start CRM Pro
          </button>
          <p className="text-xs text-gray-400 mt-3">Includes Pipeline, Diary, Customers & Reports</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LEADS TAB
// ============================================

function LeadsTab({ leads, company }: { leads: Lead[]; company: Company }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <p className="text-sm text-gray-500 mt-1">{leads.length} total leads • Balance: £{company.balance?.toFixed(2) || '0.00'}</p>
        </div>
        <Link
          href={`/company-dashboard/topup`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Top Up Balance
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">No leads yet</h3>
          <p className="text-gray-500 text-sm">Leads will appear here when customers in your postcode areas request quotes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Link key={lead.id} href={`/company-dashboard/lead/${lead.id}`} className="block">
              <div className="bg-white rounded-xl border p-5 hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {lead.instant_quotes?.starting_address || 'Unknown'} → {lead.instant_quotes?.ending_address || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • £{lead.price?.toFixed(2)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    lead.status === 'new' ? 'bg-green-100 text-green-700' :
                    lead.status === 'won' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// PIPELINE TAB (Kanban Board)
// ============================================

function PipelineTab({ stages, deals, onMoveDeal, onAddDeal, onEditDeal, onDeleteDeal }: {
  stages: PipelineStage[];
  deals: Deal[];
  onMoveDeal: (dealId: string, stageId: string) => void;
  onAddDeal: () => void;
  onEditDeal: (deal: Deal) => void;
  onDeleteDeal: (dealId: string) => void;
}) {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pipeline</h2>
          <p className="text-sm text-gray-500 mt-1">{deals.length} deals in pipeline</p>
        </div>
        <button onClick={onAddDeal} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Deal
        </button>
      </div>

      {stages.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-gray-500">Pipeline stages will be set up automatically. Add your first deal to get started.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage_id === stage.id);
            return (
              <div
                key={stage.id}
                className={`flex-shrink-0 w-72 bg-gray-100 rounded-xl p-3 transition-all ${
                  dragOverStage === stage.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  if (draggedDealId) {
                    onMoveDeal(draggedDealId, stage.id);
                    setDraggedDealId(null);
                  }
                }}
              >
                {/* Stage header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="font-semibold text-gray-800 text-sm">{stage.name}</h3>
                  <span className="ml-auto bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {stageDeals.length}
                  </span>
                </div>

                {/* Deal cards */}
                <div className="space-y-2 min-h-[60px]">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggedDealId(deal.id)}
                      onDragEnd={() => setDraggedDealId(null)}
                      className={`bg-white rounded-lg p-3 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                        draggedDealId === deal.id ? 'opacity-50' : ''
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm truncate">{deal.customer_name}</p>
                      {deal.moving_from && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{deal.moving_from} → {deal.moving_to}</p>
                      )}
                      {deal.estimated_value && (
                        <p className="text-sm font-bold text-green-600 mt-1">£{deal.estimated_value.toLocaleString()}</p>
                      )}
                      {deal.moving_date && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(deal.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditDeal(deal); }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <span className="text-gray-300">·</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteDeal(deal.id); }}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// DIARY TAB
// ============================================

function DiaryTab({ events, selectedDate, onSelectDate, onAddEvent, onEditEvent, onDeleteEvent, onToggleComplete }: {
  events: DiaryEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onAddEvent: () => void;
  onEditEvent: (event: DiaryEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}) {
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days: (number | null)[] = [];
  // Pad start (Monday-based: 0=Mon)
  const startPad = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.start_time.startsWith(dateStr));
  };

  const prevMonth = () => onSelectDate(new Date(year, month - 1, 1));
  const nextMonth = () => onSelectDate(new Date(year, month + 1, 1));

  const todaysEvents = events.filter((e) => {
    const d = new Date(e.start_time);
    return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  });

  const eventTypeColors: Record<string, string> = {
    job: 'bg-blue-100 text-blue-700',
    survey: 'bg-purple-100 text-purple-700',
    callback: 'bg-yellow-100 text-yellow-700',
    delivery: 'bg-green-100 text-green-700',
    other: 'bg-gray-100 text-gray-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diary</h2>
          <p className="text-sm text-gray-500 mt-1">{events.length} scheduled events</p>
        </div>
        <button onClick={onAddEvent} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="font-bold text-gray-900">
              {selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const dayEvents = getEventsForDay(day);
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth();

              return (
                <button
                  key={idx}
                  onClick={() => onSelectDate(new Date(year, month, day))}
                  className={`p-2 rounded-lg text-sm transition-all min-h-[48px] flex flex-col items-center ${
                    isSelected ? 'bg-blue-600 text-white' :
                    isToday ? 'bg-blue-50 text-blue-700 font-bold' :
                    'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span>{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {dayEvents.slice(0, 3).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day's events */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold text-gray-900 mb-3">
            {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          {todaysEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No events scheduled</p>
          ) : (
            <div className="space-y-3">
              {todaysEvents.map((event) => (
                <div key={event.id} className={`p-3 rounded-lg border ${event.completed ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={event.completed}
                          onChange={(e) => onToggleComplete(event.id, e.target.checked)}
                          className="rounded"
                        />
                        <span className={`font-medium text-sm ${event.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {event.title}
                        </span>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${eventTypeColors[event.event_type] || eventTypeColors.other}`}>
                        {event.event_type}
                      </span>
                      {event.customer_name && <p className="text-xs text-gray-500 mt-1">{event.customer_name}</p>}
                      {event.location && <p className="text-xs text-gray-400">{event.location}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(event.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {event.end_time && ` - ${new Date(event.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => onEditEvent(event)} className="p-1 text-blue-500 hover:text-blue-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => onDeleteEvent(event.id)} className="p-1 text-red-500 hover:text-red-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// CUSTOMERS TAB
// ============================================

function CustomersTab({ customers, search, onSearchChange, onAddCustomer, onEditCustomer, onDeleteCustomer }: {
  customers: Customer[];
  search: string;
  onSearchChange: (s: string) => void;
  onAddCustomer: () => void;
  onEditCustomer: (c: Customer) => void;
  onDeleteCustomer: (id: string) => void;
}) {
  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-1">{customers.length} total customers</p>
        </div>
        <button onClick={onAddCustomer} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search customers by name, email or phone..."
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <p className="text-gray-500">{search ? 'No customers match your search' : 'Add your first customer to get started'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-700">Name</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700 hidden md:table-cell">Email</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700 hidden md:table-cell">Phone</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700 hidden lg:table-cell">Jobs</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-700 hidden lg:table-cell">Revenue</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    {customer.address && <p className="text-xs text-gray-400 truncate max-w-[200px]">{customer.address}</p>}
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{customer.email || '—'}</td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{customer.phone || '—'}</td>
                  <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{customer.total_jobs}</td>
                  <td className="px-5 py-3 font-medium text-green-600 hidden lg:table-cell">£{customer.total_revenue?.toFixed(2) || '0.00'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => onEditCustomer(customer)} className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3">Edit</button>
                    <button onClick={() => onDeleteCustomer(customer.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// REPORTS TAB
// ============================================

function ReportsTab({ leads, deals, customers, events, company }: {
  leads: Lead[];
  deals: Deal[];
  customers: Customer[];
  events: DiaryEvent[];
  company: Company;
}) {
  const totalLeadRevenue = leads.reduce((s, l) => s + (l.price || 0), 0);
  const totalDealValue = deals.reduce((s, d) => s + (d.estimated_value || 0), 0);
  const completedEvents = events.filter((e) => e.completed).length;
  const wonLeads = leads.filter((l) => l.status === 'won').length;
  const conversionRate = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0';

  const stats = [
    { label: 'Total Leads', value: leads.length, color: 'blue', icon: 'inbox' },
    { label: 'Won Leads', value: wonLeads, color: 'green', icon: 'check' },
    { label: 'Conversion Rate', value: `${conversionRate}%`, color: 'purple', icon: 'trending' },
    { label: 'Pipeline Value', value: `£${totalDealValue.toLocaleString()}`, color: 'yellow', icon: 'cash' },
    { label: 'Total Customers', value: customers.length, color: 'indigo', icon: 'users' },
    { label: 'Pipeline Deals', value: deals.length, color: 'orange', icon: 'pipeline' },
    { label: 'Jobs Completed', value: completedEvents, color: 'teal', icon: 'check' },
    { label: 'Account Balance', value: `£${company.balance?.toFixed(2) || '0.00'}`, color: 'emerald', icon: 'cash' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    orange: 'bg-orange-50 text-orange-700',
    teal: 'bg-teal-50 text-teal-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of your business performance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border p-5">
            <p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${colorMap[stat.color]?.split(' ')[1] || 'text-gray-900'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-bold text-gray-900 mb-4">Recent Leads</h3>
        {leads.slice(0, 10).map((lead) => (
          <div key={lead.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-800 truncate">
                {lead.instant_quotes?.starting_address || 'Unknown'}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(lead.created_at).toLocaleDateString('en-GB')}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              lead.status === 'new' ? 'bg-green-100 text-green-700' :
              lead.status === 'won' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {lead.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({ company, crmActive, onSubscribe }: { company: Company; crmActive: boolean; onSubscribe: () => void }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Settings & Billing</h2>
      </div>

      {/* Company Info */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Name</p>
            <p className="font-medium text-gray-900">{company.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{company.email}</p>
          </div>
          <div>
            <p className="text-gray-500">Phone</p>
            <p className="font-medium text-gray-900">{company.phone || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Coverage Postcodes</p>
            <p className="font-medium text-gray-900">{company.coverage_postcodes?.join(', ') || 'None set'}</p>
          </div>
        </div>
      </div>

      {/* Lead Balance */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Lead Balance</h3>
        <p className="text-3xl font-bold text-blue-600">£{company.balance?.toFixed(2) || '0.00'}</p>
        <p className="text-sm text-gray-500 mt-1">Used for purchasing leads at £10.00 each</p>
      </div>

      {/* CRM Subscription */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-gray-900 mb-4">CRM Subscription</h3>
        {crmActive ? (
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <div>
              <p className="font-semibold text-green-700">CRM Pro — Active</p>
              <p className="text-sm text-gray-500">£129.99/month • Pipeline, Diary, Customers & Reports</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 mb-4">Unlock the full CRM suite to manage your removal business.</p>
            <button
              onClick={onSubscribe}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all"
            >
              Start CRM Pro — £129.99/month
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DEAL MODAL
// ============================================

function DealModal({ deal, stages, onSave, onClose }: {
  deal: Deal | null;
  stages: PipelineStage[];
  onSave: (deal: Partial<Deal>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: deal?.customer_name || '',
    customer_email: deal?.customer_email || '',
    customer_phone: deal?.customer_phone || '',
    moving_from: deal?.moving_from || '',
    moving_to: deal?.moving_to || '',
    moving_date: deal?.moving_date || '',
    estimated_value: deal?.estimated_value?.toString() || '',
    notes: deal?.notes || '',
    stage_id: deal?.stage_id || stages[0]?.id || '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{deal ? 'Edit Deal' : 'New Deal'}</h2>

        <div className="space-y-3">
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="Email" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="Phone" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <input value={form.moving_from} onChange={(e) => setForm({ ...form, moving_from: e.target.value })} placeholder="Moving from" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input value={form.moving_to} onChange={(e) => setForm({ ...form, moving_to: e.target.value })} placeholder="Moving to" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.moving_date} onChange={(e) => setForm({ ...form, moving_date: e.target.value })} className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} placeholder="Value (£)" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => {
              if (!form.customer_name.trim()) return alert('Customer name is required');
              onSave({
                ...form,
                estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
                customer_email: form.customer_email || null,
                customer_phone: form.customer_phone || null,
                moving_from: form.moving_from || null,
                moving_to: form.moving_to || null,
                moving_date: form.moving_date || null,
                notes: form.notes || null,
              });
            }}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            {deal ? 'Update' : 'Create'} Deal
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EVENT MODAL
// ============================================

function EventModal({ event, onSave, onClose }: {
  event: DiaryEvent | null;
  onSave: (event: Partial<DiaryEvent>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    start_time: event?.start_time ? event.start_time.slice(0, 16) : '',
    end_time: event?.end_time ? event.end_time.slice(0, 16) : '',
    event_type: event?.event_type || 'job',
    customer_name: event?.customer_name || '',
    location: event?.location || '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{event ? 'Edit Event' : 'New Event'}</h2>

        <div className="space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="job">Job</option>
            <option value="survey">Survey</option>
            <option value="callback">Callback</option>
            <option value="delivery">Delivery</option>
            <option value="other">Other</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start time *</label>
              <input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">End time</label>
              <input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => {
              if (!form.title.trim()) return alert('Title is required');
              if (!form.start_time) return alert('Start time is required');
              onSave({
                ...form,
                start_time: new Date(form.start_time).toISOString(),
                end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
                description: form.description || null,
                customer_name: form.customer_name || null,
                location: form.location || null,
              });
            }}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            {event ? 'Update' : 'Create'} Event
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CUSTOMER MODAL
// ============================================

function CustomerModal({ customer, onSave, onClose }: {
  customer: Customer | null;
  onSave: (c: Partial<Customer>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{customer ? 'Edit Customer' : 'New Customer'}</h2>

        <div className="space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => {
              if (!form.name.trim()) return alert('Name is required');
              onSave({
                ...form,
                email: form.email || null,
                phone: form.phone || null,
                address: form.address || null,
                notes: form.notes || null,
              });
            }}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            {customer ? 'Update' : 'Create'} Customer
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
