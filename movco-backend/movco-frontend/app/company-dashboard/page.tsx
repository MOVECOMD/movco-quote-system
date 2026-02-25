'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { downloadQuotePdf } from '@/lib/generateQuotePdf';

// ============================================
// TYPES
// ============================================

type Tab = 'leads' | 'quotes' | 'pipeline' | 'diary' | 'customers' | 'reports' | 'settings';

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
  customer_id: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  source: string | null;
  moving_from: string | null;
  moving_to: string | null;
  moving_date: string | null;
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
  deal_id: string | null;
};

type CrmQuote = {
  id: string;
  company_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  moving_from: string | null;
  moving_to: string | null;
  moving_date: string | null;
  items: any[];
  total_volume_m3: number;
  van_count: number;
  movers: number;
  estimated_price: number | null;
  status: string;
  notes: string | null;
  valid_until: string | null;
  deal_id: string | null;
  created_at: string;
};

type QuotePrefill = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  moving_from: string;
  moving_to: string;
  moving_date: string;
  notes: string;
  deal_id: string | null;
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

  // Quotes state
  const [crmQuotes, setCrmQuotes] = useState<CrmQuote[]>([]);
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [editingQuote, setEditingQuote] = useState<CrmQuote | null>(null);
  const [quotePrefill, setQuotePrefill] = useState<QuotePrefill | null>(null);

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

  // NEW: Detail popup states
  const [showDealDetail, setShowDealDetail] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DiaryEvent | null>(null);
  const [showQuickBookModal, setShowQuickBookModal] = useState(false);

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
    const { data: stagesData } = await supabase
      .from('crm_pipeline_stages')
      .select('*')
      .eq('company_id', companyId)
      .order('position');

    if (stagesData && stagesData.length > 0) {
      setStages(stagesData as PipelineStage[]);
    }

    const { data: dealsData } = await supabase
      .from('crm_deals')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (dealsData) setDeals(dealsData as Deal[]);

    const { data: eventsData } = await supabase
      .from('crm_diary_events')
      .select('*')
      .eq('company_id', companyId)
      .order('start_time');

    if (eventsData) setEvents(eventsData as DiaryEvent[]);

    const { data: customersData } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (customersData) setCustomers(customersData as Customer[]);

    const { data: quotesData } = await supabase
      .from('crm_quotes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (quotesData) setCrmQuotes(quotesData as CrmQuote[]);
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
    setShowDealDetail(false);
    setSelectedDeal(null);
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
    setShowEventDetail(false);
    setSelectedEvent(null);
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

  // Customer CRUD — UPDATED: also creates deal if stage selected
  const saveCustomer = async (customer: Partial<Customer>, stageId?: string) => {
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

        // Auto-create deal if pipeline stage was selected
        if (stageId && stages.length > 0) {
          const { data: dealData, error: dealError } = await supabase
            .from('crm_deals')
            .insert({
              company_id: company.id,
              stage_id: stageId,
              customer_id: data.id,
              customer_name: customer.name || '',
              customer_email: customer.email || null,
              customer_phone: customer.phone || null,
              moving_from: customer.moving_from || null,
              moving_to: customer.moving_to || null,
              moving_date: customer.moving_date || null,
              notes: customer.notes || null,
            })
            .select()
            .single();
          if (!dealError && dealData) {
            setDeals((prev) => [dealData as Deal, ...prev]);
          }
        }
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

  // Quote save (from builder)
  const saveQuoteFromBuilder = async (quote: Partial<CrmQuote>) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_quotes')
      .insert({ ...quote, company_id: company.id })
      .select()
      .single();
    if (!error && data) {
      setCrmQuotes((prev) => [data as CrmQuote, ...prev]);
    }
    setShowQuoteBuilder(false);
    setQuotePrefill(null);
  };

  // Quote simple edit (for status/notes changes on existing quotes)
  const updateQuoteFields = async (quoteId: string, fields: Partial<CrmQuote>) => {
    const { error } = await supabase
      .from('crm_quotes')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', quoteId);
    if (!error) {
      setCrmQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, ...fields } as CrmQuote : q)));
    }
  };

  const deleteQuote = async (quoteId: string) => {
    if (!confirm('Delete this quote?')) return;
    const { error } = await supabase.from('crm_quotes').delete().eq('id', quoteId);
    if (!error) setCrmQuotes((prev) => prev.filter((q) => q.id !== quoteId));
  };

  const updateQuoteStatus = async (quoteId: string, status: string) => {
    await updateQuoteFields(quoteId, { status } as any);
  };

  // Convert quote to deal
  const convertQuoteToDeal = async (quote: CrmQuote) => {
    if (!company || stages.length === 0) return;
    const { data, error } = await supabase
      .from('crm_deals')
      .insert({
        company_id: company.id,
        stage_id: stages[0].id,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_phone: quote.customer_phone,
        moving_from: quote.moving_from,
        moving_to: quote.moving_to,
        moving_date: quote.moving_date,
        estimated_value: quote.estimated_price,
        notes: quote.notes,
      })
      .select()
      .single();

    if (!error && data) {
      setDeals((prev) => [data as Deal, ...prev]);
      await updateQuoteStatus(quote.id, 'accepted');
      alert('Quote converted to pipeline deal!');
    }
  };

  // NEW: Quick book event from deal detail popup
  const quickBookEvent = async (event: Partial<DiaryEvent>) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_diary_events')
      .insert({ ...event, company_id: company.id })
      .select()
      .single();
    if (!error && data) {
      setEvents((prev) => [...prev, data as DiaryEvent]);
    }
    setShowQuickBookModal(false);
  };

  // NEW: Open quote builder pre-filled from event/deal
  const openQuoteFromEvent = (event: DiaryEvent) => {
    // Find linked deal if any
    const linkedDeal = event.deal_id ? deals.find((d) => d.id === event.deal_id) : null;
    setQuotePrefill({
      customer_name: event.customer_name || linkedDeal?.customer_name || '',
      customer_email: linkedDeal?.customer_email || '',
      customer_phone: linkedDeal?.customer_phone || '',
      moving_from: event.location || linkedDeal?.moving_from || '',
      moving_to: linkedDeal?.moving_to || '',
      moving_date: linkedDeal?.moving_date || '',
      notes: event.description || linkedDeal?.notes || '',
      deal_id: event.deal_id || null,
    });
    setShowEventDetail(false);
    setSelectedEvent(null);
    setActiveTab('quotes');
    setShowQuoteBuilder(true);
  };

  const openQuoteFromDeal = (deal: Deal) => {
    setQuotePrefill({
      customer_name: deal.customer_name || '',
      customer_email: deal.customer_email || '',
      customer_phone: deal.customer_phone || '',
      moving_from: deal.moving_from || '',
      moving_to: deal.moving_to || '',
      moving_date: deal.moving_date || '',
      notes: deal.notes || '',
      deal_id: deal.id,
    });
    setShowDealDetail(false);
    setSelectedDeal(null);
    setActiveTab('quotes');
    setShowQuoteBuilder(true);
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

  const crmTabs: Tab[] = ['quotes', 'pipeline', 'diary', 'customers', 'reports'];
  const isCrmTab = crmTabs.includes(activeTab);

  const navItems: { tab: Tab; label: string; icon: string; crm: boolean }[] = [
    { tab: 'quotes', label: 'Quotes', icon: 'document', crm: true },
    { tab: 'pipeline', label: 'Pipeline', icon: 'pipeline', crm: true },
    { tab: 'diary', label: 'Diary', icon: 'calendar', crm: true },
    { tab: 'customers', label: 'Customers', icon: 'users', crm: true },
    { tab: 'reports', label: 'Reports', icon: 'chart', crm: true },
    { tab: 'leads', label: 'Leads', icon: 'inbox', crm: false },
    { tab: 'settings', label: 'Settings', icon: 'settings', crm: false },
  ];

  // Check if a deal has a booked diary event
  const dealHasBooking = (dealId: string) => events.some((e) => e.deal_id === dealId);

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
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Image src="/movco-logo.png" alt="MOVCO" width={36} height={36} className="rounded-lg" />
            <div>
              <h1 className="font-bold text-lg tracking-wide">MOVCO</h1>
              <p className="text-xs text-gray-400 truncate">{company.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => { setActiveTab(item.tab); setSidebarOpen(false); setShowQuoteBuilder(false); setQuotePrefill(null); }}
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

          <div className={isCrmTab && !crmActive ? 'filter blur-sm pointer-events-none select-none' : ''}>
            {activeTab === 'leads' && <LeadsTab leads={leads} company={company} />}
            {activeTab === 'quotes' && !showQuoteBuilder && (
              <QuotesTab
                quotes={crmQuotes}
                company={company}
                onAddQuote={() => { setEditingQuote(null); setQuotePrefill(null); setShowQuoteBuilder(true); }}
                onDeleteQuote={deleteQuote}
                onUpdateStatus={updateQuoteStatus}
                onConvertToDeal={convertQuoteToDeal}
              />
            )}
            {activeTab === 'quotes' && showQuoteBuilder && (
              <QuoteBuilder
                company={company}
                onSave={saveQuoteFromBuilder}
                onCancel={() => { setShowQuoteBuilder(false); setQuotePrefill(null); }}
                prefill={quotePrefill}
              />
            )}
            {activeTab === 'pipeline' && (
              <PipelineTab
                stages={stages}
                deals={deals}
                events={events}
                onMoveDeal={moveDeal}
                onAddDeal={() => { setEditingDeal(null); setShowDealModal(true); }}
                onEditDeal={(deal) => { setEditingDeal(deal); setShowDealModal(true); }}
                onDeleteDeal={deleteDeal}
                onClickDeal={(deal) => { setSelectedDeal(deal); setShowDealDetail(true); }}
                dealHasBooking={dealHasBooking}
              />
            )}
            {activeTab === 'diary' && (
              <DiaryTab
                events={events}
                deals={deals}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onAddEvent={() => { setEditingEvent(null); setShowEventModal(true); }}
                onEditEvent={(event) => { setEditingEvent(event); setShowEventModal(true); }}
                onDeleteEvent={deleteEvent}
                onToggleComplete={toggleEventComplete}
                onClickEvent={(event) => { setSelectedEvent(event); setShowEventDetail(true); }}
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
              <ReportsTab leads={leads} deals={deals} customers={customers} events={events} crmQuotes={crmQuotes} company={company} />
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
          stages={stages}
          onSave={saveCustomer}
          onClose={() => { setShowCustomerModal(false); setEditingCustomer(null); }}
        />
      )}

      {/* NEW: Deal Detail Popup */}
      {showDealDetail && selectedDeal && (
        <DealDetailPopup
          deal={selectedDeal}
          stages={stages}
          events={events}
          onClose={() => { setShowDealDetail(false); setSelectedDeal(null); }}
          onBookAppointment={() => { setShowQuickBookModal(true); }}
          onEditDeal={() => { setShowDealDetail(false); setEditingDeal(selectedDeal); setShowDealModal(true); }}
          onDeleteDeal={() => deleteDeal(selectedDeal.id)}
          onCreateQuote={() => openQuoteFromDeal(selectedDeal)}
        />
      )}

      {/* NEW: Quick Book Modal (from deal detail) */}
      {showQuickBookModal && selectedDeal && (
        <QuickBookEventModal
          deal={selectedDeal}
          onSave={(event) => { quickBookEvent(event); setShowDealDetail(false); setSelectedDeal(null); }}
          onClose={() => setShowQuickBookModal(false)}
        />
      )}

      {/* NEW: Event Detail Popup */}
      {showEventDetail && selectedEvent && (
        <EventDetailPopup
          event={selectedEvent}
          deals={deals}
          onClose={() => { setShowEventDetail(false); setSelectedEvent(null); }}
          onCreateQuote={() => openQuoteFromEvent(selectedEvent)}
          onComplete={() => { toggleEventComplete(selectedEvent.id, !selectedEvent.completed); setSelectedEvent({ ...selectedEvent, completed: !selectedEvent.completed }); }}
          onEditEvent={() => { setShowEventDetail(false); setEditingEvent(selectedEvent); setShowEventModal(true); }}
          onDeleteEvent={() => deleteEvent(selectedEvent.id)}
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
    inbox: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>),
    document: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
    pipeline: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>),
    calendar: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>),
    users: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>),
    chart: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>),
    settings: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>),
  };
  return icons[name] || null;
}

// ============================================
// CRM LOCK OVERLAY
// ============================================

function CRMLockOverlay({ tab, onSubscribe }: { tab: Tab; onSubscribe: () => void }) {
  const features: Record<string, { title: string; bullets: string[] }> = {
    quotes: { title: 'AI Quote Builder', bullets: ['Upload photos & get AI-powered item detection', 'Auto-calculate volume, vans & movers needed', 'Adjust pricing before sending to customer', 'Convert accepted quotes to pipeline deals'] },
    pipeline: { title: 'Pipeline Management', bullets: ['Kanban drag & drop board', 'Track deals from lead to completion', 'Custom stages & deal values', 'Never lose track of a job'] },
    diary: { title: 'Diary & Scheduling', bullets: ['Calendar view of all jobs', 'Schedule surveys & callbacks', 'Track job completion', 'Never double-book again'] },
    customers: { title: 'Customer Database', bullets: ['Searchable customer records', 'Contact details & notes', 'Job history & revenue tracking', 'Build lasting relationships'] },
    reports: { title: 'Reports & Analytics', bullets: ['Revenue tracking & trends', 'Lead conversion rates', 'Pipeline performance', 'Data-driven decisions'] },
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
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}
          </div>
          <button onClick={onSubscribe} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg text-lg">
            Start CRM Pro
          </button>
          <p className="text-xs text-gray-400 mt-3">Includes Quotes, Pipeline, Diary, Customers & Reports</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AI QUOTE BUILDER — UPDATED with prefill support
// ============================================

function QuoteBuilder({ company, onSave, onCancel, prefill }: {
  company: Company;
  onSave: (q: Partial<CrmQuote>) => void;
  onCancel: () => void;
  prefill?: QuotePrefill | null;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // If prefilled, start on photos step
  const [step, setStep] = useState<'details' | 'photos' | 'analyzing' | 'results'>(prefill ? 'photos' : 'details');

  // Customer form — pre-fill if data provided
  const [customerName, setCustomerName] = useState(prefill?.customer_name || '');
  const [customerEmail, setCustomerEmail] = useState(prefill?.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState(prefill?.customer_phone || '');
  const [movingFrom, setMovingFrom] = useState(prefill?.moving_from || '');
  const [movingTo, setMovingTo] = useState(prefill?.moving_to || '');
  const [movingDate, setMovingDate] = useState(prefill?.moving_date || '');
  const [notes, setNotes] = useState(prefill?.notes || '');

  // Photo state
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // AI results
  const [aiResult, setAiResult] = useState<any>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Editable result fields
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editPrice, setEditPrice] = useState('');
  const [editVolume, setEditVolume] = useState('');
  const [editVans, setEditVans] = useState('1');
  const [editMovers, setEditMovers] = useState('2');

  // Photo handlers
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload photos to Supabase then analyze
  const uploadAndAnalyze = async () => {
    if (files.length === 0) {
      alert('Please upload at least one photo');
      return;
    }
    if (!movingFrom.trim() || !movingTo.trim()) {
      alert('Please enter moving from and moving to addresses');
      return;
    }

    setStep('analyzing');
    setAnalyzeError(null);

    try {
      const urls: string[] = [];
      for (const file of files) {
        const filePath = `crm-quotes/${company.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('movco-photos')
          .upload(filePath, file);

        if (uploadError) {
          const { data: uploadData2, error: uploadError2 } = await supabase.storage
            .from('photos')
            .upload(filePath, file);
          if (uploadError2) {
            console.error('Upload error:', uploadError2);
            continue;
          }
          const { data: pubData2 } = supabase.storage.from('photos').getPublicUrl(filePath);
          if (pubData2?.publicUrl) urls.push(pubData2.publicUrl);
        } else {
          const { data: pubData } = supabase.storage.from('movco-photos').getPublicUrl(filePath);
          if (pubData?.publicUrl) urls.push(pubData.publicUrl);
        }
      }

      setUploadedUrls(urls);

      if (urls.length === 0) {
        throw new Error('Failed to upload photos. Please try again.');
      }

      const response = await fetch('https://movco-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_address: movingFrom,
          ending_address: movingTo,
          photo_urls: urls,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed (${response.status}). Please try again.`);
      }

      const data = await response.json();
      setAiResult(data);

      setEditItems(data.items || []);
      setEditPrice(data.estimate?.toFixed(2) || '');
      setEditVolume(data.totalVolumeM3?.toString() || '');

      const vol = data.totalVolumeM3 || 0;
      setEditVans(vol <= 15 ? '1' : vol <= 30 ? '2' : '3');
      setEditMovers(vol <= 15 ? '2' : vol <= 30 ? '3' : '4');

      setStep('results');
    } catch (err: any) {
      console.error('Analyze error:', err);
      setAnalyzeError(err?.message || 'Something went wrong. Please try again.');
      setStep('photos');
    }
  };

  // Save final quote
  const handleSaveQuote = () => {
    if (!customerName.trim()) {
      alert('Please enter a customer name');
      return;
    }

    onSave({
      customer_name: customerName,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      moving_from: movingFrom || null,
      moving_to: movingTo || null,
      moving_date: movingDate || null,
      items: editItems,
      total_volume_m3: editVolume ? parseFloat(editVolume) : 0,
      van_count: parseInt(editVans) || 1,
      movers: parseInt(editMovers) || 2,
      estimated_price: editPrice ? parseFloat(editPrice) : null,
      notes: notes || null,
      status: 'draft',
      deal_id: prefill?.deal_id || null,
    } as any);
  };

  // Step indicator
  const steps = [
    { key: 'details', label: 'Customer Details' },
    { key: 'photos', label: 'Upload Photos' },
    { key: 'results', label: 'Review & Save' },
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
            <h2 className="text-2xl font-bold text-gray-900">New AI Quote</h2>
            <p className="text-sm text-gray-500">
              {prefill ? `Pre-filled for ${prefill.customer_name}` : 'Upload photos for AI-powered item detection & pricing'}
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => {
          const stepKeys = ['details', 'photos', 'results'];
          const currentIdx = stepKeys.indexOf(step === 'analyzing' ? 'photos' : step);
          const isActive = stepKeys.indexOf(s.key) === currentIdx;
          const isDone = stepKeys.indexOf(s.key) < currentIdx;
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

      {/* ===== STEP 1: Customer Details ===== */}
      {step === 'details' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Customer Details
            </h3>
            <div className="space-y-3">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name *" className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Email" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" className="px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Move Details
            </h3>
            <div className="space-y-3">
              <input value={movingFrom} onChange={(e) => setMovingFrom(e.target.value)} placeholder="Moving from *" className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input value={movingTo} onChange={(e) => setMovingTo(e.target.value)} placeholder="Moving to *" className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Moving date</label>
                  <input type="date" value={movingDate} onChange={(e) => setMovingDate(e.target.value)} className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </div>

          <button
            onClick={() => {
              if (!customerName.trim()) return alert('Customer name is required');
              if (!movingFrom.trim() || !movingTo.trim()) return alert('Moving from and moving to are required');
              setStep('photos');
            }}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg"
          >
            Next — Upload Photos →
          </button>
        </div>
      )}

      {/* ===== STEP 2: Photo Upload ===== */}
      {step === 'photos' && (
        <div className="space-y-6">
          {/* Show pre-filled customer summary if prefilled */}
          {prefill && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">{customerName}</p>
                <p className="text-sm text-blue-700">{movingFrom} → {movingTo}</p>
              </div>
              <button onClick={() => setStep('details')} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 bg-white rounded-lg border border-blue-200">
                Edit Details
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Upload Room Photos
            </h3>
            <p className="text-sm text-gray-500 mb-5">Take photos of each room or upload from gallery. Our AI will detect all items and calculate volumes.</p>

            {analyzeError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                <p className="text-sm text-red-700">{analyzeError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-800">Take Photo</p>
                  <p className="text-xs text-gray-500 mt-0.5">Use your camera</p>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraChange} className="hidden" />
              </label>

              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-green-400 hover:bg-green-50/50 transition-all">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-800">Upload Photos</p>
                  <p className="text-xs text-gray-500 mt-0.5">Choose from gallery</p>
                </div>
                <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGalleryChange} className="hidden" />
              </label>
            </div>

            {files.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">{files.length} photo{files.length !== 1 ? 's' : ''} ready</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-100">
                      <img src={URL.createObjectURL(file)} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">
              ← Back
            </button>
            <button
              onClick={uploadAndAnalyze}
              disabled={files.length === 0}
              className={`flex-1 font-semibold py-3.5 rounded-xl transition text-lg ${
                files.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Analyze with AI ({files.length} photo{files.length !== 1 ? 's' : ''})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ===== ANALYZING STATE ===== */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 animate-pulse shadow-2xl">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Photos...</h3>
          <p className="text-gray-500 text-sm mb-6">Our AI is detecting items and calculating volumes</p>
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-blue-600 font-medium text-sm">This usually takes 30-60 seconds...</span>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Results ===== */}
      {step === 'results' && aiResult && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-blue-200">AI Estimated Cost</p>
                <p className="text-4xl font-bold">£{parseFloat(editPrice || '0').toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-200">Customer</p>
                <p className="text-lg font-semibold">{customerName}</p>
              </div>
            </div>
            <p className="text-sm text-blue-200">{movingFrom} → {movingTo}</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4">Adjust Pricing & Logistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Volume (m³)</label>
                <input type="number" value={editVolume} onChange={(e) => setEditVolume(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Vans</label>
                <input type="number" value={editVans} onChange={(e) => setEditVans(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" min="1" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Movers</label>
                <input type="number" value={editMovers} onChange={(e) => setEditMovers(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" min="1" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Your Price (£)</label>
                <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm font-bold text-green-600 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4">Items Detected ({editItems.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {editItems.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800">×{item.quantity}</span>
                    {item.estimated_volume_ft3 && (
                      <span className="text-xs text-gray-500 ml-2">{item.estimated_volume_ft3?.toFixed(1)} ft³</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {uploadedUrls.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold text-gray-900 mb-4">Photos ({uploadedUrls.length})</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {uploadedUrls.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden border">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('photos')} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">
              ← Back
            </button>
            <button
              onClick={() => {
                downloadQuotePdf({
                  companyName: company.name,
                  companyEmail: company.email,
                  companyPhone: company.phone,
                  quoteDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                  status: 'draft',
                  customerName,
                  customerEmail: customerEmail || undefined,
                  customerPhone: customerPhone || undefined,
                  movingFrom: movingFrom || undefined,
                  movingTo: movingTo || undefined,
                  movingDate: movingDate || undefined,
                  items: editItems || [],
                  totalVolume: editVolume ? parseFloat(editVolume) : undefined,
                  vanCount: editVans ? parseInt(editVans) : undefined,
                  movers: editMovers ? parseInt(editMovers) : undefined,
                  estimatedPrice: editPrice ? parseFloat(editPrice) : undefined,
                  notes: notes || undefined,
                });
              }}
              className="px-6 py-3.5 bg-blue-50 text-blue-600 font-semibold rounded-xl hover:bg-blue-100 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              PDF
            </button>
            <button
              onClick={handleSaveQuote}
              className="flex-1 bg-green-600 text-white font-semibold py-3.5 rounded-xl hover:bg-green-700 transition text-lg shadow-lg"
            >
              Save Quote — £{parseFloat(editPrice || '0').toFixed(2)}
            </button>
          </div>
        </div>
      )}
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
        <Link href="/company-dashboard/topup" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Top Up Balance
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
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
                    <p className="font-semibold text-gray-900 truncate">{lead.instant_quotes?.starting_address || 'Unknown'} → {lead.instant_quotes?.ending_address || 'Unknown'}</p>
                    <p className="text-sm text-gray-500 mt-1">{new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • £{lead.price?.toFixed(2)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${lead.status === 'new' ? 'bg-green-100 text-green-700' : lead.status === 'won' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{lead.status}</span>
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
// QUOTES TAB (list view)
// ============================================

function QuotesTab({ quotes, company, onAddQuote, onDeleteQuote, onUpdateStatus, onConvertToDeal }: {
  quotes: CrmQuote[];
  company: Company;
  onAddQuote: () => void;
  onDeleteQuote: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onConvertToDeal: (q: CrmQuote) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleDownloadPdf = (quote: CrmQuote) => {
    downloadQuotePdf({
      companyName: company.name,
      companyEmail: company.email,
      companyPhone: company.phone,
      quoteRef: quote.id.slice(0, 8).toUpperCase(),
      quoteDate: new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      validUntil: quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-GB') : undefined,
      status: quote.status,
      customerName: quote.customer_name,
      customerEmail: quote.customer_email || undefined,
      customerPhone: quote.customer_phone || undefined,
      movingFrom: quote.moving_from || undefined,
      movingTo: quote.moving_to || undefined,
      movingDate: quote.moving_date || undefined,
      items: quote.items || [],
      totalVolume: quote.total_volume_m3 || undefined,
      vanCount: quote.van_count || undefined,
      movers: quote.movers || undefined,
      estimatedPrice: quote.estimated_price || undefined,
      notes: quote.notes || undefined,
    });
  };

  const filtered = filterStatus === 'all' ? quotes : quotes.filter((q) => q.status === filterStatus);

  const statusCounts: Record<string, number> = {
    all: quotes.length,
    draft: quotes.filter((q) => q.status === 'draft').length,
    sent: quotes.filter((q) => q.status === 'sent').length,
    accepted: quotes.filter((q) => q.status === 'accepted').length,
    declined: quotes.filter((q) => q.status === 'declined').length,
  };

  const totalQuoteValue = quotes.reduce((s, q) => s + (q.estimated_price || 0), 0);
  const acceptedValue = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.estimated_price || 0), 0);

  const statusStyles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    expired: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quotes</h2>
          <p className="text-sm text-gray-500 mt-1">{quotes.length} quotes • £{totalQuoteValue.toLocaleString()} total value • £{acceptedValue.toLocaleString()} accepted</p>
        </div>
        <button onClick={onAddQuote} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          + New AI Quote
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'draft', 'sent', 'accepted', 'declined'].map((status) => (
          <button key={status} onClick={() => setFilterStatus(status)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">{filterStatus === 'all' ? 'No quotes yet' : `No ${filterStatus} quotes`}</h3>
          <p className="text-gray-500 text-sm mb-4">Upload photos and let AI create accurate quotes for your customers.</p>
          <button onClick={onAddQuote} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Create Your First AI Quote
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quote) => (
            <div key={quote.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{quote.customer_name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyles[quote.status] || statusStyles.draft}`}>{quote.status}</span>
                  </div>
                  {(quote.moving_from || quote.moving_to) && (
                    <p className="text-sm text-gray-600 mb-1">{quote.moving_from || '—'} → {quote.moving_to || '—'}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {quote.moving_date && <span>📅 {new Date(quote.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    {quote.total_volume_m3 > 0 && <span>📦 {quote.total_volume_m3} m³</span>}
                    {quote.van_count && <span>🚛 {quote.van_count} van{quote.van_count !== 1 ? 's' : ''}</span>}
                    {quote.movers && <span>👷 {quote.movers} movers</span>}
                    {quote.items && quote.items.length > 0 && <span>🪑 {quote.items.length} items</span>}
                    <span>{new Date(quote.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {quote.estimated_price && (
                    <p className="text-xl font-bold text-green-600">£{quote.estimated_price.toLocaleString()}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 flex-wrap">
                {quote.status === 'draft' && (
                  <button onClick={() => onUpdateStatus(quote.id, 'sent')} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">Mark as Sent</button>
                )}
                {quote.status === 'sent' && (
                  <>
                    <button onClick={() => onConvertToDeal(quote)} className="text-xs font-medium text-green-600 hover:text-green-800 px-3 py-1.5 bg-green-50 rounded-lg hover:bg-green-100 transition">Accepted → Pipeline</button>
                    <button onClick={() => onUpdateStatus(quote.id, 'declined')} className="text-xs font-medium text-orange-600 hover:text-orange-800 px-3 py-1.5 bg-orange-50 rounded-lg hover:bg-orange-100 transition">Declined</button>
                  </>
                )}
                <button onClick={() => handleDownloadPdf(quote)} className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  PDF
                </button>
                <button onClick={() => onDeleteQuote(quote.id)} className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition ml-auto">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// PIPELINE TAB — UPDATED: clickable deal cards
// ============================================

function PipelineTab({ stages, deals, events, onMoveDeal, onAddDeal, onEditDeal, onDeleteDeal, onClickDeal, dealHasBooking }: {
  stages: PipelineStage[]; deals: Deal[]; events: DiaryEvent[];
  onMoveDeal: (dealId: string, stageId: string) => void;
  onAddDeal: () => void; onEditDeal: (deal: Deal) => void; onDeleteDeal: (dealId: string) => void;
  onClickDeal: (deal: Deal) => void;
  dealHasBooking: (dealId: string) => boolean;
}) {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">Pipeline</h2><p className="text-sm text-gray-500 mt-1">{deals.length} deals in pipeline</p></div>
        <button onClick={onAddDeal} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Deal
        </button>
      </div>
      {stages.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><p className="text-gray-500">Pipeline stages will be set up automatically. Add your first deal to get started.</p></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage_id === stage.id);
            return (
              <div key={stage.id} className={`flex-shrink-0 w-72 bg-gray-100 rounded-xl p-3 transition-all ${dragOverStage === stage.id ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverStage(null); if (draggedDealId) { onMoveDeal(draggedDealId, stage.id); setDraggedDealId(null); } }}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="font-semibold text-gray-800 text-sm">{stage.name}</h3>
                  <span className="ml-auto bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{stageDeals.length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]">
                  {stageDeals.map((deal) => {
                    const hasBooking = dealHasBooking(deal.id);
                    return (
                      <div key={deal.id} draggable onDragStart={() => setDraggedDealId(deal.id)} onDragEnd={() => setDraggedDealId(null)}
                        onClick={() => onClickDeal(deal)}
                        className={`bg-white rounded-lg p-3 shadow-sm border cursor-pointer hover:shadow-md transition-all ${draggedDealId === deal.id ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-gray-900 text-sm truncate flex-1">{deal.customer_name}</p>
                          {hasBooking && (
                            <span className="ml-1 text-blue-500 flex-shrink-0" title="Appointment booked">📅</span>
                          )}
                        </div>
                        {deal.moving_from && <p className="text-xs text-gray-500 mt-1 truncate">{deal.moving_from} → {deal.moving_to}</p>}
                        {deal.estimated_value && <p className="text-sm font-bold text-green-600 mt-1">£{deal.estimated_value.toLocaleString()}</p>}
                        {deal.moving_date && <p className="text-xs text-gray-400 mt-1">{new Date(deal.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
                      </div>
                    );
                  })}
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
// DIARY TAB — UPDATED: clickable events open popup
// ============================================

function DiaryTab({ events, deals, selectedDate, onSelectDate, onAddEvent, onEditEvent, onDeleteEvent, onToggleComplete, onClickEvent }: {
  events: DiaryEvent[]; deals: Deal[]; selectedDate: Date; onSelectDate: (d: Date) => void;
  onAddEvent: () => void; onEditEvent: (e: DiaryEvent) => void; onDeleteEvent: (id: string) => void; onToggleComplete: (id: string, c: boolean) => void;
  onClickEvent: (e: DiaryEvent) => void;
}) {
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const days: (number | null)[] = [];
  const startPad = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.start_time.startsWith(dateStr));
  };

  const selectedDayEvents = events.filter((e) => {
    const d = new Date(e.start_time);
    return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  });

  const handleDayClick = (day: number) => {
    onSelectDate(new Date(year, month, day));
    setViewMode('day');
  };

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    onSelectDate(prev);
  };

  const goToNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    onSelectDate(next);
  };

  const eventTypeColors: Record<string, { bg: string; border: string; text: string }> = {
    job: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
    survey: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
    callback: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
    delivery: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
    other: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' },
  };

  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  const getEventStyle = (event: DiaryEvent) => {
    const start = new Date(event.start_time);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
    const endHour = end.getHours() + end.getMinutes() / 60;
    const duration = Math.max(endHour - startHour, 0.5);

    const top = (startHour - 6) * 64;
    const height = Math.max(duration * 64, 28);

    return { top: `${top}px`, height: `${height}px` };
  };

  const isEventVisible = (event: DiaryEvent) => {
    const start = new Date(event.start_time);
    const hour = start.getHours();
    return hour >= 6 && hour <= 22;
  };

  const nowHour = today.getHours() + today.getMinutes() / 60;
  const isToday = selectedDate.getDate() === today.getDate() && selectedDate.getMonth() === today.getMonth() && selectedDate.getFullYear() === today.getFullYear();
  const currentTimeTop = (nowHour - 6) * 64;

  const monthDeals = deals.filter((d) => {
    if (!d.moving_date) return false;
    const dd = new Date(d.moving_date);
    return dd.getMonth() === month && dd.getFullYear() === year;
  });

  const monthlyRevenue = monthDeals.reduce((s, d) => s + (d.estimated_value || 0), 0);

  const weeklyRevenue: Record<number, { revenue: number; deals: number; startDate: Date; endDate: Date }> = {};
  
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  let weekStart = new Date(firstOfMonth);
  const dow = weekStart.getDay();
  if (dow !== 1) weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
  
  let weekNum = 1;
  while (weekStart <= lastOfMonth) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeklyRevenue[weekNum] = { revenue: 0, deals: 0, startDate: new Date(weekStart), endDate: new Date(weekEnd) };
    
    monthDeals.forEach((deal) => {
      const dd = new Date(deal.moving_date!);
      if (dd >= weekStart && dd <= weekEnd) {
        weeklyRevenue[weekNum].revenue += deal.estimated_value || 0;
        weeklyRevenue[weekNum].deals += 1;
      }
    });
    
    weekStart.setDate(weekStart.getDate() + 7);
    weekNum++;
  }

  const completedJobsThisMonth = events.filter((e) => {
    if (!e.completed || e.event_type !== 'job') return false;
    const d = new Date(e.start_time);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diary</h2>
          <p className="text-sm text-gray-500 mt-1">{events.length} scheduled events</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Day
            </button>
          </div>
          <button
            onClick={() => { onSelectDate(new Date()); setViewMode('day'); }}
            className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
          >
            Today
          </button>
          <button onClick={onAddEvent} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Event
          </button>
        </div>
      </div>

      {/* ===== MONTH VIEW ===== */}
      {viewMode === 'month' && (
        <>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onSelectDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 className="font-bold text-gray-900 text-lg">{selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
            <button onClick={() => onSelectDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const dayEvents = getEventsForDay(day);
              const isTodayCell = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth();
              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  className={`p-1.5 rounded-lg text-sm transition-all min-h-[72px] flex flex-col items-start ${
                    isSelected ? 'bg-blue-600 text-white ring-2 ring-blue-300' : isTodayCell ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className={`text-xs font-semibold mb-1 ${isTodayCell && !isSelected ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>{day}</span>
                  {dayEvents.slice(0, 2).map((evt, i) => {
                    const colors = eventTypeColors[evt.event_type] || eventTypeColors.other;
                    return (
                      <div key={i} className={`w-full text-left truncate text-[10px] px-1 py-0.5 rounded mb-0.5 ${isSelected ? 'bg-white/20 text-white' : `${colors.bg} ${colors.text}`}`}>
                        {new Date(evt.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {evt.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>+{dayEvents.length - 2} more</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Weekly & Monthly Revenue */}
        <div className="bg-white rounded-xl border p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Revenue — {selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">£{monthlyRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{monthDeals.length} deal{monthDeals.length !== 1 ? 's' : ''} • {completedJobsThisMonth} job{completedJobsThisMonth !== 1 ? 's' : ''} completed</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {Object.entries(weeklyRevenue).map(([week, data]) => {
              const weekLabel = `${data.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${data.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
              const percentage = monthlyRevenue > 0 ? (data.revenue / monthlyRevenue) * 100 : 0;
              return (
                <div key={week} className="flex items-center gap-3">
                  <div className="w-24 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">Week {week}</p>
                    <p className="text-[10px] text-gray-400">{weekLabel}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, data.revenue > 0 ? 8 : 0)}%` }}
                      />
                      {data.revenue > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700">
                          {data.deals} deal{data.deals !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-20 text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${data.revenue > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                      £{data.revenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm font-semibold text-gray-800">Monthly Total</span>
            </div>
            <p className="text-xl font-bold text-green-600">£{monthlyRevenue.toLocaleString()}</p>
          </div>
        </div>
        </>
      )}

      {/* ===== DAY VIEW ===== */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <button onClick={goToPrevDay} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              <h3 className="font-bold text-gray-900 text-lg">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center justify-center gap-3 mt-0.5">
                <p className="text-xs text-gray-500">{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</p>
                {(() => {
                  const dayDeals = deals.filter((d) => {
                    if (!d.moving_date) return false;
                    const dd = new Date(d.moving_date);
                    return dd.getDate() === selectedDate.getDate() && dd.getMonth() === selectedDate.getMonth() && dd.getFullYear() === selectedDate.getFullYear();
                  });
                  const dayRev = dayDeals.reduce((s, d) => s + (d.estimated_value || 0), 0);
                  return dayRev > 0 ? (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">£{dayRev.toLocaleString()} revenue</span>
                  ) : null;
                })()}
              </div>
            </div>
            <button onClick={goToNextDay} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {selectedDayEvents.filter(e => !isEventVisible(e)).length > 0 && (
            <div className="px-5 py-2 border-b bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 mb-1">Other times</p>
              {selectedDayEvents.filter(e => !isEventVisible(e)).map((event) => {
                const colors = eventTypeColors[event.event_type] || eventTypeColors.other;
                return (
                  <div key={event.id} onClick={() => onClickEvent(event)} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-pointer mr-2 mb-1 ${colors.bg} ${colors.text}`}>
                    {new Date(event.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {event.title}
                  </div>
                );
              })}
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
            <div className="relative" style={{ height: `${hours.length * 64}px` }}>
              {hours.map((hour) => (
                <div key={hour} className="absolute w-full flex" style={{ top: `${(hour - 6) * 64}px`, height: '64px' }}>
                  <div className="w-16 sm:w-20 flex-shrink-0 pr-2 text-right">
                    <span className="text-xs text-gray-400 font-medium -mt-2 block">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </span>
                  </div>
                  <div className="flex-1 border-t border-gray-100 relative group cursor-pointer hover:bg-blue-50/30 transition"
                    onClick={() => onAddEvent()}
                  >
                    <div className="absolute w-full border-t border-gray-50" style={{ top: '32px' }} />
                    <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition">
                      <span className="text-[10px] text-blue-400 font-medium">+ Add</span>
                    </div>
                  </div>
                </div>
              ))}

              {isToday && nowHour >= 6 && nowHour <= 23 && (
                <div className="absolute left-16 sm:left-20 right-0 z-20 flex items-center" style={{ top: `${currentTimeTop}px` }}>
                  <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}

              {selectedDayEvents.filter(isEventVisible).map((event) => {
                const style = getEventStyle(event);
                const colors = eventTypeColors[event.event_type] || eventTypeColors.other;
                const startTime = new Date(event.start_time);
                const endTime = event.end_time ? new Date(event.end_time) : null;
                return (
                  <div
                    key={event.id}
                    className={`absolute left-16 sm:left-20 right-2 z-10 rounded-lg border-l-4 px-3 py-1.5 cursor-pointer hover:shadow-md transition-all overflow-hidden ${colors.bg} ${colors.border} ${event.completed ? 'opacity-50' : ''}`}
                    style={{ top: style.top, height: style.height, minHeight: '28px' }}
                    onClick={() => onClickEvent(event)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${colors.text}`}>{event.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {endTime && ` – ${endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                        {event.customer_name && <p className="text-[11px] text-gray-500 truncate">{event.customer_name}</p>}
                        {event.location && <p className="text-[10px] text-gray-400 truncate">📍 {event.location}</p>}
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0 mt-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleComplete(event.id, !event.completed); }}
                          className={`w-5 h-5 rounded flex items-center justify-center transition ${event.completed ? 'bg-green-500 text-white' : 'border border-gray-300 hover:border-green-400'}`}
                        >
                          {event.completed && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                          className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// CUSTOMERS TAB
// ============================================

function CustomersTab({ customers, search, onSearchChange, onAddCustomer, onEditCustomer, onDeleteCustomer }: {
  customers: Customer[]; search: string; onSearchChange: (s: string) => void;
  onAddCustomer: () => void; onEditCustomer: (c: Customer) => void; onDeleteCustomer: (id: string) => void;
}) {
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">Customers</h2><p className="text-sm text-gray-500 mt-1">{customers.length} total customers</p></div>
        <button onClick={onAddCustomer} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Customer</button>
      </div>
      <div className="mb-4"><input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search customers..." className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><p className="text-gray-500">{search ? 'No customers match your search' : 'Add your first customer to get started'}</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="text-left px-5 py-3 font-semibold text-gray-700">Name</th><th className="text-left px-5 py-3 font-semibold text-gray-700 hidden md:table-cell">Email</th><th className="text-left px-5 py-3 font-semibold text-gray-700 hidden md:table-cell">Phone</th><th className="text-left px-5 py-3 font-semibold text-gray-700 hidden lg:table-cell">Source</th><th className="text-left px-5 py-3 font-semibold text-gray-700 hidden lg:table-cell">Revenue</th><th className="text-right px-5 py-3 font-semibold text-gray-700">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3"><p className="font-medium text-gray-900">{customer.name}</p>{customer.moving_from && <p className="text-xs text-gray-400 truncate max-w-[200px]">{customer.moving_from} → {customer.moving_to || '—'}</p>}</td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{customer.email || '—'}</td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{customer.phone || '—'}</td>
                  <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">{customer.source || '—'}</td>
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

function ReportsTab({ leads, deals, customers, events, crmQuotes, company }: {
  leads: Lead[]; deals: Deal[]; customers: Customer[]; events: DiaryEvent[]; crmQuotes: CrmQuote[]; company: Company;
}) {
  const totalDealValue = deals.reduce((s, d) => s + (d.estimated_value || 0), 0);
  const totalQuoteValue = crmQuotes.reduce((s, q) => s + (q.estimated_price || 0), 0);
  const acceptedQuoteValue = crmQuotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.estimated_price || 0), 0);
  const completedEvents = events.filter((e) => e.completed).length;
  const wonLeads = leads.filter((l) => l.status === 'won').length;
  const conversionRate = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0';
  const quoteConversion = crmQuotes.length > 0 ? ((crmQuotes.filter(q => q.status === 'accepted').length / crmQuotes.length) * 100).toFixed(1) : '0';

  const stats = [
    { label: 'Total Leads', value: leads.length, color: 'text-blue-700' },
    { label: 'Won Leads', value: wonLeads, color: 'text-green-700' },
    { label: 'Lead Conversion', value: `${conversionRate}%`, color: 'text-purple-700' },
    { label: 'Pipeline Value', value: `£${totalDealValue.toLocaleString()}`, color: 'text-yellow-700' },
    { label: 'Quotes Sent', value: crmQuotes.length, color: 'text-indigo-700' },
    { label: 'Quote Conversion', value: `${quoteConversion}%`, color: 'text-teal-700' },
    { label: 'Total Quote Value', value: `£${totalQuoteValue.toLocaleString()}`, color: 'text-orange-700' },
    { label: 'Accepted Value', value: `£${acceptedQuoteValue.toLocaleString()}`, color: 'text-emerald-700' },
    { label: 'Total Customers', value: customers.length, color: 'text-indigo-700' },
    { label: 'Pipeline Deals', value: deals.length, color: 'text-orange-700' },
    { label: 'Jobs Completed', value: completedEvents, color: 'text-teal-700' },
    { label: 'Account Balance', value: `£${company.balance?.toFixed(2) || '0.00'}`, color: 'text-emerald-700' },
  ];

  return (
    <div>
      <div className="mb-6"><h2 className="text-2xl font-bold text-gray-900">Reports</h2><p className="text-sm text-gray-500 mt-1">Overview of your business performance</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border p-5"><p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p><p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p></div>
        ))}
      </div>
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-bold text-gray-900 mb-4">Recent Leads</h3>
        {leads.slice(0, 10).map((lead) => (
          <div key={lead.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div><p className="text-sm font-medium text-gray-800 truncate">{lead.instant_quotes?.starting_address || 'Unknown'}</p><p className="text-xs text-gray-400">{new Date(lead.created_at).toLocaleDateString('en-GB')}</p></div>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${lead.status === 'new' ? 'bg-green-100 text-green-700' : lead.status === 'won' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{lead.status}</span>
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
      <div className="mb-6"><h2 className="text-2xl font-bold text-gray-900">Settings & Billing</h2></div>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><p className="text-gray-500">Name</p><p className="font-medium text-gray-900">{company.name}</p></div>
          <div><p className="text-gray-500">Email</p><p className="font-medium text-gray-900">{company.email}</p></div>
          <div><p className="text-gray-500">Phone</p><p className="font-medium text-gray-900">{company.phone || '—'}</p></div>
          <div><p className="text-gray-500">Coverage Postcodes</p><p className="font-medium text-gray-900">{company.coverage_postcodes?.join(', ') || 'None set'}</p></div>
        </div>
      </div>
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Lead Balance</h3>
        <p className="text-3xl font-bold text-blue-600">£{company.balance?.toFixed(2) || '0.00'}</p>
        <p className="text-sm text-gray-500 mt-1">Used for purchasing leads at £10.00 each</p>
      </div>
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-gray-900 mb-4">CRM Subscription</h3>
        {crmActive ? (
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <div><p className="font-semibold text-green-700">CRM Pro — Active</p><p className="text-sm text-gray-500">£129.99/month • Quotes, Pipeline, Diary, Customers & Reports</p></div>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 mb-4">Unlock the full CRM suite to manage your removal business.</p>
            <button onClick={onSubscribe} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all">Start CRM Pro — £129.99/month</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DEAL MODAL
// ============================================

function DealModal({ deal, stages, onSave, onClose }: { deal: Deal | null; stages: PipelineStage[]; onSave: (deal: Partial<Deal>) => void; onClose: () => void; }) {
  const [form, setForm] = useState({
    customer_name: deal?.customer_name || '', customer_email: deal?.customer_email || '', customer_phone: deal?.customer_phone || '',
    moving_from: deal?.moving_from || '', moving_to: deal?.moving_to || '', moving_date: deal?.moving_date || '',
    estimated_value: deal?.estimated_value?.toString() || '', notes: deal?.notes || '', stage_id: deal?.stage_id || stages[0]?.id || '',
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
          <button onClick={() => { if (!form.customer_name.trim()) return alert('Customer name is required'); onSave({ ...form, estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null, customer_email: form.customer_email || null, customer_phone: form.customer_phone || null, moving_from: form.moving_from || null, moving_to: form.moving_to || null, moving_date: form.moving_date || null, notes: form.notes || null } as any); }} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">{deal ? 'Update' : 'Create'} Deal</button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EVENT MODAL
// ============================================

function EventModal({ event, onSave, onClose }: { event: DiaryEvent | null; onSave: (e: Partial<DiaryEvent>) => void; onClose: () => void; }) {
  const [form, setForm] = useState({
    title: event?.title || '', description: event?.description || '', start_time: event?.start_time ? event.start_time.slice(0, 16) : '',
    end_time: event?.end_time ? event.end_time.slice(0, 16) : '', event_type: event?.event_type || 'job', customer_name: event?.customer_name || '', location: event?.location || '',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{event ? 'Edit Event' : 'New Event'}</h2>
        <div className="space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="job">Job</option><option value="survey">Survey</option><option value="callback">Callback</option><option value="delivery">Delivery</option><option value="other">Other</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Start time *</label><input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">End time</label><input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          </div>
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => { if (!form.title.trim()) return alert('Title is required'); if (!form.start_time) return alert('Start time is required'); onSave({ ...form, start_time: new Date(form.start_time).toISOString(), end_time: form.end_time ? new Date(form.end_time).toISOString() : null, description: form.description || null, customer_name: form.customer_name || null, location: form.location || null }); }} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">{event ? 'Update' : 'Create'} Event</button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CUSTOMER MODAL — ENHANCED with source, move details, pipeline stage
// ============================================

function CustomerModal({ customer, stages, onSave, onClose }: {
  customer: Customer | null;
  stages: PipelineStage[];
  onSave: (c: Partial<Customer>, stageId?: string) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
    source: customer?.source || '',
    moving_from: customer?.moving_from || '',
    moving_to: customer?.moving_to || '',
    moving_date: customer?.moving_date || '',
  });
  const [selectedStage, setSelectedStage] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{customer ? 'Edit Customer' : 'New Customer'}</h2>
        <div className="space-y-4">
          {/* Customer Details Section */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer Details</p>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" type="tel" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700">
                <option value="">Source (how did they find you?)</option>
                <option value="Website">Website</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Referral">Referral</option>
                <option value="Social Media">Social Media</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Move Details Section */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Move Details</p>
            <div className="space-y-3">
              <input value={form.moving_from} onChange={(e) => setForm({ ...form, moving_from: e.target.value })} placeholder="Moving from address" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input value={form.moving_to} onChange={(e) => setForm({ ...form, moving_to: e.target.value })} placeholder="Moving to address" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Preferred moving date</label>
                <input type="date" value={form.moving_date} onChange={(e) => setForm({ ...form, moving_date: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Pipeline Stage — only show when creating new */}
          {!customer && stages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pipeline</p>
              <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700">
                <option value="">No pipeline stage (customer only)</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {selectedStage && (
                <p className="text-xs text-blue-600 mt-1.5">A deal will be automatically created in the selected pipeline stage.</p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => {
              if (!form.name.trim()) return alert('Name is required');
              onSave(
                {
                  name: form.name,
                  email: form.email || null,
                  phone: form.phone || null,
                  address: form.address || form.moving_from || null,
                  notes: form.notes || null,
                  source: form.source || null,
                  moving_from: form.moving_from || null,
                  moving_to: form.moving_to || null,
                  moving_date: form.moving_date || null,
                } as any,
                selectedStage || undefined
              );
            }}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            {customer ? 'Update' : 'Create'} Customer{selectedStage ? ' + Deal' : ''}
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NEW: DEAL DETAIL POPUP
// ============================================

function DealDetailPopup({ deal, stages, events, onClose, onBookAppointment, onEditDeal, onDeleteDeal, onCreateQuote }: {
  deal: Deal;
  stages: PipelineStage[];
  events: DiaryEvent[];
  onClose: () => void;
  onBookAppointment: () => void;
  onEditDeal: () => void;
  onDeleteDeal: () => void;
  onCreateQuote: () => void;
}) {
  const stage = stages.find((s) => s.id === deal.stage_id);
  const linkedEvents = events.filter((e) => e.deal_id === deal.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">{deal.customer_name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Customer Info */}
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            {deal.customer_email && (
              <span className="flex items-center gap-1.5 text-gray-600">📧 {deal.customer_email}</span>
            )}
            {deal.customer_phone && (
              <span className="flex items-center gap-1.5 text-gray-600">📱 {deal.customer_phone}</span>
            )}
          </div>
          {(deal.moving_from || deal.moving_to) && (
            <p className="text-sm text-gray-700">📍 {deal.moving_from || '—'} → {deal.moving_to || '—'}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {deal.moving_date && (
              <span className="text-sm text-gray-600">📅 {new Date(deal.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
            {deal.estimated_value && (
              <span className="text-sm font-bold text-green-600">💰 £{deal.estimated_value.toLocaleString()}</span>
            )}
          </div>
          {stage && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Stage:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                {stage.name}
              </span>
            </div>
          )}
          {deal.notes && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{deal.notes}</p>
          )}

          {/* Linked diary events */}
          {linkedEvents.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Booked Appointments</p>
              {linkedEvents.map((evt) => (
                <div key={evt.id} className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <span>📅</span>
                  <span>{new Date(evt.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {new Date(evt.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{evt.event_type}</span>
                  {evt.completed && <span className="text-green-500">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex flex-wrap gap-2">
          <button onClick={onBookAppointment} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
            📅 Book Appointment
          </button>
          <button onClick={onCreateQuote} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">
            📸 Create Quote
          </button>
          <button onClick={onEditDeal} className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
            ✏️ Edit
          </button>
          <button onClick={onDeleteDeal} className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition">
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NEW: QUICK BOOK EVENT MODAL (from pipeline deal)
// ============================================

function QuickBookEventModal({ deal, onSave, onClose }: {
  deal: Deal;
  onSave: (event: Partial<DiaryEvent>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    event_type: 'survey',
    start_time: '',
    end_time: '',
  });

  const title = `${form.event_type.charAt(0).toUpperCase() + form.event_type.slice(1)} — ${deal.customer_name}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Book Appointment</h2>
        <p className="text-sm text-gray-500 mb-5">For {deal.customer_name}</p>

        <div className="space-y-3">
          {/* Event type */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="survey">Survey</option>
              <option value="job">Job</option>
              <option value="callback">Callback</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Auto-generated title preview */}
          <div className="bg-gray-50 rounded-lg px-4 py-2.5">
            <p className="text-xs text-gray-500 mb-0.5">Event title</p>
            <p className="text-sm font-medium text-gray-800">{title}</p>
          </div>

          {/* Auto-filled location */}
          {deal.moving_from && (
            <div className="bg-gray-50 rounded-lg px-4 py-2.5">
              <p className="text-xs text-gray-500 mb-0.5">Location</p>
              <p className="text-sm font-medium text-gray-800">📍 {deal.moving_from}</p>
            </div>
          )}

          {/* Date/time */}
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
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => {
              if (!form.start_time) return alert('Start time is required');
              onSave({
                title,
                event_type: form.event_type,
                start_time: new Date(form.start_time).toISOString(),
                end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
                customer_name: deal.customer_name,
                location: deal.moving_from || null,
                deal_id: deal.id,
                description: deal.notes || null,
              });
            }}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Book Appointment
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NEW: EVENT DETAIL POPUP
// ============================================

function EventDetailPopup({ event, deals, onClose, onCreateQuote, onComplete, onEditEvent, onDeleteEvent }: {
  event: DiaryEvent;
  deals: Deal[];
  onClose: () => void;
  onCreateQuote: () => void;
  onComplete: () => void;
  onEditEvent: () => void;
  onDeleteEvent: () => void;
}) {
  const linkedDeal = event.deal_id ? deals.find((d) => d.id === event.deal_id) : null;
  const startTime = new Date(event.start_time);
  const endTime = event.end_time ? new Date(event.end_time) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">{event.title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Event Info */}
        <div className="p-5 space-y-3">
          {/* Contact info from linked deal */}
          {linkedDeal && (
            <div className="flex flex-wrap gap-3 text-sm">
              {linkedDeal.customer_email && (
                <span className="flex items-center gap-1.5 text-gray-600">📧 {linkedDeal.customer_email}</span>
              )}
              {linkedDeal.customer_phone && (
                <span className="flex items-center gap-1.5 text-gray-600">📱 {linkedDeal.customer_phone}</span>
              )}
            </div>
          )}

          {/* Addresses */}
          {(event.location || linkedDeal?.moving_from) && (
            <p className="text-sm text-gray-700">
              📍 {event.location || linkedDeal?.moving_from || '—'}
              {linkedDeal?.moving_to && ` → ${linkedDeal.moving_to}`}
            </p>
          )}

          {/* Time */}
          <p className="text-sm text-gray-600">
            🕐 {startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            {endTime && ` – ${endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          </p>

          {/* Date */}
          <p className="text-sm text-gray-600">
            📅 {startTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${event.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {event.completed ? '✅ Completed' : '○ Not completed'}
            </span>
          </div>

          {/* Event type badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Type:</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 capitalize">{event.event_type}</span>
          </div>

          {/* Notes */}
          {(event.description || linkedDeal?.notes) && (
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{event.description || linkedDeal?.notes}</p>
          )}

          {/* Linked deal value */}
          {linkedDeal?.estimated_value && (
            <p className="text-sm font-bold text-green-600">💰 Deal value: £{linkedDeal.estimated_value.toLocaleString()}</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex flex-wrap gap-2">
          <button onClick={onCreateQuote} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">
            📸 Create Quote
          </button>
          <button onClick={onComplete} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg transition ${event.completed ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {event.completed ? '↩️ Undo Complete' : '✅ Complete'}
          </button>
          <button onClick={onEditEvent} className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
            ✏️ Edit
          </button>
          <button onClick={onDeleteEvent} className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition">
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}
