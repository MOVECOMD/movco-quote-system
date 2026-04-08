'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { downloadQuotePdf } from '@/lib/generateQuotePdf';
import { downloadInvoicePdf } from '@/lib/generateInvoicePdf';
import AiAssistant from '@/components/AiAssistant';
import TradesQuoteBuilder from '@/components/TradesQuoteBuilder';
import SimpleQuoteBuilder from '@/components/SimpleQuoteBuilder';

// ============================================
// TYPES
// ============================================

type Tab = 'leads' | 'quotes' | 'pipeline' | 'diary' | 'customers' | 'reports' | 'settings' | 'automations' | 'website' | 'social' | 'whatsapp' | 'media';

type Company = {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  coverage_postcodes: string[];
  stripe_customer_id: string | null;
  template_type?: string;
  company_name?: string;
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

type Pipeline = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  is_default: boolean;
};

type PipelineStage = {
  id: string;
  name: string;
  color: string;
  position: number;
  pipeline_id?: string;
};


type Deal = {
  id: string;
  stage_id: string;
  pipeline_id?: string;
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
type CustomerNote = {
  id: string;
  company_id: string;
  customer_id: string;
  note_text: string;
  created_at: string;
};
type CustomerTask = {
  id: string;
  company_id: string;
  customer_id: string;
  title: string;
  due_date: string;
  completed: boolean;
  created_at: string;
};
type CustomerFile = {
  id: string;
  company_id: string;
  customer_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
};
type CrmCost = {
  id: string;
  company_id: string;
  deal_id: string | null;
  category: string;
  description: string | null;
  amount: number;
  cost_date: string;
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
  cost_breakdown: { category: string; description: string; amount: number }[];
  distance_miles: number | null;
  estimated_hours: number | null;
  status: string;
  notes: string | null;
  valid_until: string | null;
  deal_id: string | null;
  created_at: string;
  additional_services: { name: string; price: number }[] | null;
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
const [terminology, setTerminology] = useState<Record<string, string>>({});
const [quoteBuilderType, setQuoteBuilderType] = useState<string>('removals');

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
  const [selectedQuote, setSelectedQuote] = useState<CrmQuote | null>(null);
  const [showQuoteDetail, setShowQuoteDetail] = useState(false);

  // Pipeline state
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  // Diary state
  const [events, setEvents] = useState<DiaryEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');

  // PDF branding state
  const [pdfBranding, setPdfBranding] = useState<any>({});

  // Pricing config state
  const [pricingConfig, setPricingConfig] = useState<any>({ hourly_rate: 45, minimum_hours: 2, fuel_rate_per_mile: 0.50, van_cost_per_day: 75 });

  // Email connection state
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailAddress, setEmailAddress] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(true);

  // Modal states
  const [showDealModal, setShowDealModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingEvent, setEditingEvent] = useState<DiaryEvent | null>(null);
  const [eventPrefillDate, setEventPrefillDate] = useState<Date | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Detail popup states
  const [showDealDetail, setShowDealDetail] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<DiaryEvent | null>(null);
  const [showQuickBookModal, setShowQuickBookModal] = useState(false);
  const [showStageManager, setShowStageManager] = useState(false);
  const [showComposeEmail, setShowComposeEmail] = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
const [bulkEmailRecipients, setBulkEmailRecipients] = useState<{ name: string; email: string }[]>([]);
  const [composeEmailCustomer, setComposeEmailCustomer] = useState<Customer | null>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [customerTasks, setCustomerTasks] = useState<CustomerTask[]>([]);
  const [customerFiles, setCustomerFiles] = useState<CustomerFile[]>([]);

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

  // Check email connection status on settings page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('email') === 'connected') {
      const addr = params.get('address');
      alert(`✅ Gmail connected! Emails will be sent from ${addr || 'your Gmail'}`);
      setEmailConnected(true);
      setEmailAddress(addr || null);
      window.history.replaceState({}, '', '/company-dashboard/settings');
    } else if (params.get('email') === 'error') {
      alert(`❌ Gmail connection failed: ${params.get('reason') || 'unknown error'}. Please try again.`);
      window.history.replaceState({}, '', '/company-dashboard/settings');
    }
  }, []);

  // Load email connection status
  useEffect(() => {
    async function checkEmailConnection() {
      if (!company) return;
      try {
        const res = await fetch(`/api/email/status?company_id=${company.id}`);
        const data = await res.json();
        setEmailConnected(data.connected);
        setEmailAddress(data.email_address);
      } catch (err) {
        console.error('Failed to check email status:', err);
      }
      setEmailLoading(false);
    }
    if (company) checkEmailConnection();
  }, [company]);

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

const { data: templateConfig } = await supabase
  .from('template_configs')
  .select('terminology, feature_flags')
  .eq('template_type', companyData.template_type || 'removals')
  .maybeSingle();

if (templateConfig?.terminology) {
  setTerminology(templateConfig.terminology);
}
if (templateConfig?.feature_flags?.quote_builder_type) {
  setQuoteBuilderType(templateConfig.feature_flags.quote_builder_type);
}
// Fallback: if no feature_flags, derive from template type
if (!templateConfig?.feature_flags?.quote_builder_type) {
  const type = companyData.template_type || 'removals';
  const noQuote = ['estate_agent','letting_agent','vet','dental','salon','barber','personal_trainer','dog_groomer','tutor','retail','physio'];
  const tradesTypes = ['plumber','electrician','builder','painter','roofer','locksmith','handyman','hvac','mechanic','security','flooring','pest_control','gardener'];
  if (noQuote.includes(type)) setQuoteBuilderType('simple');
  else if (tradesTypes.includes(type)) setQuoteBuilderType('trades');
  else if (type === 'removals') setQuoteBuilderType('removals');
  else setQuoteBuilderType('simple');
}

      const { data: subData } = await supabase
        .from('crm_subscriptions')
        .select('*')
        .eq('company_id', companyData.id)
        .eq('status', 'active')
        .maybeSingle();

      // Also check if user is on a buildyourmanagement trial
const { data: companyRow } = await supabase
  .from('companies')
  .select('plan_status, trial_ends_at')
  .eq('id', companyData.id)
  .maybeSingle()

const onActiveTrial = companyRow?.plan_status === 'trial' && 
  companyRow?.trial_ends_at && 
  new Date(companyRow.trial_ends_at) > new Date()

setCrmActive(!!subData || !!onActiveTrial)

if (!!subData || !!onActiveTrial) {
  await loadCRMData(companyData.id)
}
      setCrmLoading(false);

      const { data: leadsData } = await supabase
        .from('company_leads')
        .select('*, instant_quotes(*)')
        .eq('company_id', companyData.id)
        .order('created_at', { ascending: false });

      if (leadsData) setLeads(leadsData as Lead[]);

      if (subData) {
        await loadCRMData(companyData.id);
      }

      setLoading(false);
    }

    if (user) loadData();
  }, [user]);

  const loadCRMData = async (companyId: string) => {
     // Load pipelines first
    const { data: pipelinesData } = await supabase
      .from('crm_pipelines')
      .select('*')
      .eq('company_id', companyId)
      .order('position');

    if (pipelinesData && pipelinesData.length > 0) {
      setPipelines(pipelinesData as Pipeline[]);
      // Set active pipeline to default or first one
      if (!activePipelineId) {
        const defaultPipeline = pipelinesData.find((p: any) => p.is_default) || pipelinesData[0];
        setActivePipelineId(defaultPipeline.id);
      }
    } else {
      // No pipelines exist — auto-seed everything from template
      try {
        const { data: companyInfo } = await supabase.from('companies').select('template_type').eq('id', companyId).maybeSingle();
        const seedRes = await fetch('/api/seed-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, template_type: companyInfo?.template_type || 'default' }),
        });
        const seedData = await seedRes.json();
        if (seedData.success) {
          // Re-fetch pipelines after seeding
          const { data: seededPipelines } = await supabase.from('crm_pipelines').select('*').eq('company_id', companyId).order('position');
          if (seededPipelines && seededPipelines.length > 0) {
            setPipelines(seededPipelines as Pipeline[]);
            const defaultP = seededPipelines.find((p: any) => p.is_default) || seededPipelines[0];
            setActivePipelineId(defaultP.id);
          }
        }
      } catch (err) {
        console.error('Auto-seed failed:', err);
        // Fallback — just create a basic pipeline
        const { data: newPipeline } = await supabase
          .from('crm_pipelines')
          .insert({ company_id: companyId, name: 'Sales Pipeline', is_default: true, position: 1 })
          .select()
          .single();
        if (newPipeline) {
          setPipelines([newPipeline as Pipeline]);
          setActivePipelineId(newPipeline.id);
        }
      }
    }

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

    const { data: tasksData } = await supabase
      .from('crm_customer_tasks')
      .select('*')
      .eq('company_id', companyId)
      .eq('completed', false)
      .order('due_date', { ascending: true });
    if (tasksData) setAllCompanyTasks(tasksData);

    const { data: costsData } = await supabase
      .from('crm_costs')
      .select('*')
      .eq('company_id', companyId)
      .order('cost_date', { ascending: false });
    if (costsData) setCrmCosts(costsData);

    const { data: configData } = await supabase
      .from('company_config')
      .select('pdf_template, pricing_rules, custom_event_types, custom_customer_fields, custom_sources')
      .eq('company_id', companyId)
      .maybeSingle();
    if (configData?.pdf_template) setPdfBranding(configData.pdf_template);
    if (configData?.pricing_rules) setPricingConfig((prev: any) => ({ ...prev, ...configData.pricing_rules }));
    if (configData?.custom_event_types) setCustomEventTypes(configData.custom_event_types);
    if (configData?.custom_customer_fields) setCustomCustomerFields(configData.custom_customer_fields);
    if (configData?.custom_sources && configData.custom_sources.length > 0) setCustomSources(configData.custom_sources);
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
        .insert({ ...deal, company_id: company.id, pipeline_id: activePipelineId })
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

  const saveEvent = async (event: Partial<DiaryEvent>, recipientEmail?: string) => {
    if (!company) return;
    if (editingEvent) {
      const { error } = await supabase
        .from('crm_diary_events')
        .update(event)
        .eq('id', editingEvent.id);
      if (error) {
        console.error('Update event error:', error);
        alert('Failed to update event: ' + error.message);
      } else {
        setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? { ...e, ...event } as DiaryEvent : e)));
      }
    } else {
      const { data, error } = await supabase
        .from('crm_diary_events')
        .insert({ ...event, company_id: company.id })
        .select()
        .single();
      if (error) {
        console.error('Insert event error:', error);
        alert('Failed to create event: ' + error.message);
      }
      if (!error && data) {
        setEvents((prev) => [...prev, data as DiaryEvent]);
        // Auto-send confirmation email for new events
        if (emailConnected && recipientEmail) {
          await sendConfirmationEmail(event, recipientEmail, event.customer_name || undefined, data.id);
        }
      }
    }
    setShowEventModal(false);
    setEditingEvent(null);
  };
const rescheduleEvent = async (eventId: string, newDate: Date) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const oldStart = new Date(event.start_time);
    const newStart = new Date(newDate);
    if (newDate.getHours() === 0 && newDate.getMinutes() === 0) {
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0);
    }
    let newEnd: Date | null = null;
    if (event.end_time) {
      const oldEnd = new Date(event.end_time);
      const diff = oldEnd.getTime() - oldStart.getTime();
      newEnd = new Date(newStart.getTime() + diff);
    }
    const updates: any = { start_time: newStart.toISOString() };
    if (newEnd) updates.end_time = newEnd.toISOString();
    const { error } = await supabase.from('crm_diary_events').update(updates).eq('id', eventId);
    if (!error) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, start_time: newStart.toISOString(), end_time: newEnd ? newEnd.toISOString() : e.end_time } : e));
    }
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

  const sendQuoteLink = async (customer: Customer) => {
    if (!company) { alert('Company not loaded yet.'); return; }
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    const { error } = await supabase.from('quote_requests').insert({
      token,
      company_id: company.id,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      moving_from: customer.moving_from,
      moving_to: customer.moving_to,
      moving_date: customer.moving_date,
    });
    if (error) {
      console.error('Failed to create quote link:', error);
      alert('Failed to create quote link. Please try again.');
      return;
    }
    const link = `${window.location.origin}/quote-request/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      alert(`✅ Quote link copied to clipboard!\n\nSend this to ${customer.name}:\n${link}`);
    } catch {
      prompt('Copy this quote link:', link);
    }
  };

     const saveQuoteFromBuilder = async (quote: Partial<CrmQuote>) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_quotes')
      .insert({ ...quote, company_id: company.id })
      .select()
      .single();
    if (!error && data) {
      // Ensure deal_id is preserved in local state even if DB doesn't return it
      const savedQuote = { ...data, deal_id: data.deal_id || quote.deal_id || null } as CrmQuote;
      setCrmQuotes((prev) => [savedQuote, ...prev]);

      // Update the linked deal's estimated_value with the quote price
      if (quote.deal_id && quote.estimated_price) {
        await supabase
          .from('crm_deals')
          .update({ estimated_value: quote.estimated_price, updated_at: new Date().toISOString() })
          .eq('id', quote.deal_id);
        setDeals((prev) => prev.map((d) => d.id === quote.deal_id ? { ...d, estimated_value: quote.estimated_price! } : d));
      }
    }
    setShowQuoteBuilder(false);
    setQuotePrefill(null);
  };

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

    if (status === 'sent') {
      const quote = crmQuotes.find((q) => q.id === quoteId);
      if (quote?.deal_id) {
        const quoteSentStage = stages.find((s) => s.name.toLowerCase().includes('quote sent'));
        if (quoteSentStage) {
          await moveDeal(quote.deal_id, quoteSentStage.id);
        }
      } else if (quote) {
        const quoteSentStage = stages.find((s) => s.name.toLowerCase().includes('quote sent'));
        if (quoteSentStage && company && stages.length > 0) {
          const { data: dealData, error } = await supabase
            .from('crm_deals')
            .insert({
              company_id: company.id,
              stage_id: quoteSentStage.id,
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
          if (!error && dealData) {
            setDeals((prev) => [dealData as Deal, ...prev]);
            await supabase.from('crm_quotes').update({ deal_id: dealData.id }).eq('id', quoteId);
            setCrmQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, deal_id: dealData.id } as CrmQuote : q)));
          }
        }
      }
    }
  };

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

  const sendConfirmationEmail = async (event: Partial<DiaryEvent>, recipientEmail: string, recipientName?: string, eventId?: string) => {
    if (!company || !emailConnected) return;
    try {
      const res = await fetch('/api/email/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName || event.customer_name || 'there',
          event_type: event.event_type || 'other',
          event_title: event.title || 'Appointment',
          start_time: event.start_time,
          end_time: event.end_time || null,
          location: event.location || null,
          description: event.description || null,
          event_id: eventId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Confirmation email sent to ${recipientEmail}`);
      } else {
        console.error('Email send failed:', data.error);
      }
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }
  };
// ── Pipeline Stage Management ──
  const addPipelineStage = async (name: string, color: string) => {
    if (!company || !activePipelineId) return;
    const activeStages = stages.filter(s => s.pipeline_id === activePipelineId);
    const maxPos = activeStages.length > 0 ? Math.max(...activeStages.map(s => s.position)) : 0;
    const { data, error } = await supabase
      .from('crm_pipeline_stages')
      .insert({
        company_id: company.id,
        pipeline_id: activePipelineId,
        name,
        color,
        position: maxPos + 1,
      })
      .select()
      .single();
    if (!error && data) {
      setStages(prev => [...prev, data as PipelineStage]);
    }
    return { data, error };
  };

  const updatePipelineStage = async (stageId: string, updates: Partial<PipelineStage>) => {
    const { error } = await supabase
      .from('crm_pipeline_stages')
      .update(updates)
      .eq('id', stageId);
    if (!error) {
      setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...updates } as PipelineStage : s));
    }
    return { error };
  };

  const reorderPipelineStages = async (reorderedStages: PipelineStage[]) => {
    for (const stage of reorderedStages) {
      await supabase
        .from('crm_pipeline_stages')
        .update({ position: stage.position })
        .eq('id', stage.id);
    }
    setStages(reorderedStages);
  };

  const deletePipelineStage = async (stageId: string, moveDealsToStageId: string | null) => {
    if (!company) return;
    if (moveDealsToStageId) {
      const { error: moveError } = await supabase
        .from('crm_deals')
        .update({ stage_id: moveDealsToStageId })
        .eq('stage_id', stageId);
      if (moveError) {
        alert('Failed to move deals: ' + moveError.message);
        return;
      }
      setDeals(prev => prev.map(d => d.stage_id === stageId ? { ...d, stage_id: moveDealsToStageId } : d));
    }
    const { error } = await supabase
      .from('crm_pipeline_stages')
      .delete()
      .eq('id', stageId);
    if (!error) {
      setStages(prev => {
        const filtered = prev.filter(s => s.id !== stageId);
        return filtered.map((s, i) => ({ ...s, position: i + 1 }));
      });
    }
  };
 // ── Pipeline Management ──
  const createPipeline = async (name: string, color?: string) => {
    if (!company) return;
    const maxPos = pipelines.length > 0 ? Math.max(...pipelines.map(p => p.position)) : 0;
    const { data, error } = await supabase
      .from('crm_pipelines')
      .insert({
        company_id: company.id,
        name,
        color: color || '#3b82f6',
        position: maxPos + 1,
        is_default: pipelines.length === 0,
      })
      .select()
      .single();
    if (!error && data) {
      setPipelines(prev => [...prev, data as Pipeline]);
      setActivePipelineId(data.id);
    }
    return { data, error };
  };

  const renamePipeline = async (pipelineId: string, name: string) => {
    const { error } = await supabase
      .from('crm_pipelines')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', pipelineId);
    if (!error) {
      setPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, name } : p));
    }
  };

  const deletePipeline = async (pipelineId: string) => {
    if (!company) return;
    if (pipelines.length <= 1) { alert('You must have at least one pipeline'); return; }
    const stagesInPipeline = stages.filter(s => s.pipeline_id === pipelineId);
    const dealsInPipeline = deals.filter(d => d.pipeline_id === pipelineId);
    if (dealsInPipeline.length > 0) {
      alert(`This pipeline has ${dealsInPipeline.length} deal(s). Move or delete them first.`);
      return;
    }
    if (!confirm(`Delete this pipeline and its ${stagesInPipeline.length} stage(s)?`)) return;
    // Delete stages first
    await supabase.from('crm_pipeline_stages').delete().eq('pipeline_id', pipelineId);
    const { error } = await supabase.from('crm_pipelines').delete().eq('id', pipelineId);
    if (!error) {
      setPipelines(prev => prev.filter(p => p.id !== pipelineId));
      setStages(prev => prev.filter(s => s.pipeline_id !== pipelineId));
      if (activePipelineId === pipelineId) {
        const remaining = pipelines.filter(p => p.id !== pipelineId);
        setActivePipelineId(remaining[0]?.id || null);
      }
    }
  };

  // ── Customer Notes ──
  const fetchCustomerNotes = async (customerId: string) => {
    if (!company) return;
    const { data } = await supabase
      .from('crm_customer_notes')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    if (data) setCustomerNotes(data);
  };

  const addCustomerNote = async (customerId: string, noteText: string) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_customer_notes')
      .insert({
        company_id: company.id,
        customer_id: customerId,
        note_text: noteText,
      })
      .select()
      .single();
    if (!error && data) {
      setCustomerNotes(prev => [data, ...prev]);
    }
    return { error };
  };

  const deleteCustomerNote = async (noteId: string) => {
    const { error } = await supabase
      .from('crm_customer_notes')
      .delete()
      .eq('id', noteId);
    if (!error) {
      setCustomerNotes(prev => prev.filter(n => n.id !== noteId));
    }
  };

  // ── Customer Tasks ──
  const fetchCustomerTasks = async (customerId: string) => {
    if (!company) return;
    const { data } = await supabase
      .from('crm_customer_tasks')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', company.id)
      .order('due_date', { ascending: true });
    if (data) setCustomerTasks(data);
  };

  const addCustomerTask = async (customerId: string, title: string, dueDate: string) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_customer_tasks')
      .insert({
        company_id: company.id,
        customer_id: customerId,
        title,
        due_date: dueDate,
      })
      .select()
      .single();
    if (!error && data) {
      setCustomerTasks(prev => [...prev, data].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()));
    }
    return { error };
  };

  const toggleCustomerTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from('crm_customer_tasks')
      .update({ completed })
      .eq('id', taskId);
    if (!error) {
      setCustomerTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    }
  };

  const deleteCustomerTask = async (taskId: string) => {
    const { error } = await supabase
      .from('crm_customer_tasks')
      .delete()
      .eq('id', taskId);
    if (!error) {
      setCustomerTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  // ── Customer Files ──
  const fetchCustomerFiles = async (customerId: string) => {
    if (!company) return;
    const { data } = await supabase
      .from('crm_customer_files')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    if (data) setCustomerFiles(data);
  };

  const uploadCustomerFile = async (customerId: string, file: File) => {
    if (!company) return;
    const filePath = `${company.id}/${customerId}/${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('crm-files')
      .upload(filePath, file);
    if (uploadError) {
      console.error('File upload error:', uploadError);
      alert('Failed to upload file: ' + uploadError.message);
      return;
    }
    const { data: pubData } = supabase.storage.from('crm-files').getPublicUrl(filePath);
    if (!pubData?.publicUrl) {
      alert('Failed to get file URL');
      return;
    }
    const { data, error } = await supabase
      .from('crm_customer_files')
      .insert({
        company_id: company.id,
        customer_id: customerId,
        file_name: file.name,
        file_url: pubData.publicUrl,
        file_size: file.size,
        file_type: file.type || null,
      })
      .select()
      .single();
    if (!error && data) {
      setCustomerFiles(prev => [data, ...prev]);
    }
    return { error };
  };

  const deleteCustomerFile = async (fileId: string, fileUrl: string) => {
    // Delete from storage
    try {
      const urlParts = fileUrl.split('/crm-files/');
      if (urlParts[1]) {
        await supabase.storage.from('crm-files').remove([decodeURIComponent(urlParts[1])]);
      }
    } catch (err) {
      console.error('Storage delete error:', err);
    }
    // Delete metadata row
    const { error } = await supabase
      .from('crm_customer_files')
      .delete()
      .eq('id', fileId);
    if (!error) {
      setCustomerFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  const [allCompanyTasks, setAllCompanyTasks] = useState<CustomerTask[]>([]);
  const [crmCosts, setCrmCosts] = useState<CrmCost[]>([]);
const [customEventTypes, setCustomEventTypes] = useState<{ key: string; label: string; color: string }[]>([
  { key: 'job', label: 'Job', color: '#3b82f6' },
  { key: 'survey', label: 'Survey', color: '#8b5cf6' },
  { key: 'callback', label: 'Callback', color: '#f59e0b' },
  { key: 'delivery', label: 'Delivery', color: '#22c55e' },
  { key: 'packing', label: 'Packing', color: '#f97316' },
  { key: 'other', label: 'Other', color: '#6b7280' },
]);
const [customCustomerFields, setCustomCustomerFields] = useState<{ key: string; label: string; type: string }[]>([]);
const [customSources, setCustomSources] = useState<string[]>(['Website', 'Phone Call', 'Referral', 'Social Media', 'Walk-in', 'Google', 'Facebook', 'Instagram', 'Other']);
// ── Costs ──
  const fetchCosts = async () => {
    if (!company) return;
    const { data } = await supabase
      .from('crm_costs')
      .select('*')
      .eq('company_id', company.id)
      .order('cost_date', { ascending: false });
    if (data) setCrmCosts(data);
  };

  const addCost = async (cost: Partial<CrmCost>) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_costs')
      .insert({ ...cost, company_id: company.id })
      .select()
      .single();
    if (!error && data) {
      setCrmCosts(prev => [data, ...prev]);
    }
    return { error };
  };

  const updateCost = async (costId: string, fields: Partial<CrmCost>) => {
    const { error } = await supabase
      .from('crm_costs')
      .update(fields)
      .eq('id', costId);
    if (!error) {
      setCrmCosts(prev => prev.map(c => c.id === costId ? { ...c, ...fields } as CrmCost : c));
    }
  };

  const deleteCost = async (costId: string) => {
    const { error } = await supabase
      .from('crm_costs')
      .delete()
      .eq('id', costId);
    if (!error) {
      setCrmCosts(prev => prev.filter(c => c.id !== costId));
    }
  };
  const saveCustomEventTypes = async (types: { key: string; label: string; color: string }[]) => {
    if (!company) return;
    const { error } = await supabase
      .from('company_config')
      .upsert({ company_id: company.id, custom_event_types: types }, { onConflict: 'company_id' });
    if (!error) setCustomEventTypes(types);
    return { error };
  };

  const saveCustomCustomerFields = async (fields: { key: string; label: string; type: string }[]) => {
    if (!company) return;
    const { error } = await supabase
      .from('company_config')
      .upsert({ company_id: company.id, custom_customer_fields: fields }, { onConflict: 'company_id' });
    if (!error) setCustomCustomerFields(fields);
    return { error };
  };
const saveCustomSources = async (sources: string[]) => {
    if (!company) return;
    const { error } = await supabase
      .from('company_config')
      .upsert({ company_id: company.id, custom_sources: sources }, { onConflict: 'company_id' });
    if (!error) setCustomSources(sources);
    return { error };
  };
  const fetchAllCompanyTasks = async () => {
    if (!company) return;
    const { data } = await supabase
      .from('crm_customer_tasks')
      .select('*')
      .eq('company_id', company.id)
      .eq('completed', false)
      .order('due_date', { ascending: true });
    if (data) setAllCompanyTasks(data);
  };

 const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
const [showDayPlan, setShowDayPlan] = useState(false);

  const openCustomerDetail = (customer: Customer, deal?: Deal | null) => {
    setSelectedCustomer(customer);
    setDetailDeal(deal || null);
    setShowCustomerDetail(true);
    fetchCustomerNotes(customer.id);
    fetchCustomerTasks(customer.id);
    fetchCustomerFiles(customer.id);
  };

  const openCustomerFromDeal = (deal: Deal) => {
    const customer = customers.find(c => c.id === deal.customer_id);
    if (customer) {
      openCustomerDetail(customer, deal);
    } else {
      // No linked customer — create a temporary one from deal data
      const tempCustomer: Customer = {
        id: '',
        name: deal.customer_name,
        email: deal.customer_email,
        phone: deal.customer_phone,
        address: deal.moving_from,
        notes: deal.notes,
        source: null,
        moving_from: deal.moving_from,
        moving_to: deal.moving_to,
        moving_date: deal.moving_date,
        total_jobs: 0,
        total_revenue: 0,
        created_at: deal.created_at,
      };
      setSelectedCustomer(tempCustomer);
      setDetailDeal(deal);
      setShowCustomerDetail(true);
      setCustomerNotes([]);
      setCustomerTasks([]);
      setCustomerFiles([]);
    }
  };
  const disconnectEmail = async () => {
    if (!company) return;
    if (!confirm('Disconnect Gmail? Confirmation emails will stop sending.')) return;
    try {
      await fetch(`/api/email/status?company_id=${company.id}`, { method: 'DELETE' });
      setEmailConnected(false);
      setEmailAddress(null);
    } catch (err) {
      console.error('Failed to disconnect email:', err);
    }
  };

  const quickBookEvent = async (event: Partial<DiaryEvent>) => {
    if (!company) return;
    const { data, error } = await supabase
      .from('crm_diary_events')
      .insert({ ...event, company_id: company.id })
      .select()
      .single();
    if (!error && data) {
      setEvents((prev) => [...prev, data as DiaryEvent]);
      // Auto-send confirmation email if connected
      if (emailConnected) {
        const linkedDeal = event.deal_id ? deals.find((d) => d.id === event.deal_id) : null;
        const recipientEmail = linkedDeal?.customer_email;
        if (recipientEmail) {
          await sendConfirmationEmail(event, recipientEmail, event.customer_name || linkedDeal?.customer_name, data.id);
        }
      }
      // Auto-create costs from linked quote's cost_breakdown when booking a job
      if (event.event_type === 'job' && event.deal_id) {
        const linkedQuote = crmQuotes.find(q => q.deal_id === event.deal_id);
        if (linkedQuote?.cost_breakdown && linkedQuote.cost_breakdown.length > 0) {
          const costDate = data.start_time ? new Date(data.start_time).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          for (const cb of linkedQuote.cost_breakdown) {
            if (cb.amount > 0) {
              await addCost({
                category: cb.category,
                description: cb.description || `Auto from quote: ${linkedQuote.customer_name}`,
                amount: cb.amount,
                deal_id: event.deal_id,
                cost_date: costDate,
              } as any);
            }
          }
        }
      }
    }
    // Auto-book packing day before if quote has packing service
      const linkedQuote2 = crmQuotes.find(q => q.deal_id === event.deal_id);
      const hasPacking = linkedQuote2?.additional_services?.some(s => s.name.toLowerCase().includes('packing'));
      if (hasPacking && data?.start_time) {
        const packingDate = new Date(data.start_time);
        packingDate.setDate(packingDate.getDate() - 1);
        packingDate.setHours(8, 0, 0, 0);
        const packingEnd = new Date(packingDate.getTime() + 4 * 3600000);
        await supabase.from('crm_diary_events').insert({
          company_id: company.id,
          title: `Packing — ${event.customer_name || 'Customer'}`,
          event_type: 'packing',
          start_time: packingDate.toISOString(),
          end_time: packingEnd.toISOString(),
          customer_name: event.customer_name || null,
          location: event.location || null,
          deal_id: event.deal_id || null,
          description: 'Auto-booked: packing day before move',
          color: '#f97316',
          completed: false,
        });
        setEvents(prev => [...prev, {
          id: crypto.randomUUID(),
          title: `Packing — ${event.customer_name || 'Customer'}`,
          event_type: 'packing',
          start_time: packingDate.toISOString(),
          end_time: packingEnd.toISOString(),
          customer_name: event.customer_name || null,
          location: event.location || null,
          deal_id: event.deal_id || null,
          description: 'Auto-booked: packing day before move',
          color: '#f97316',
          completed: false,
        } as DiaryEvent]);
        alert(`📦 Packing day auto-booked for ${packingDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`);
      }
    setShowQuickBookModal(false);
  };

  const openQuoteFromEvent = (event: DiaryEvent) => {
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
    { tab: 'quotes',      label: terminology.quotes      || 'Quotes',      icon: 'document',    crm: true },
    { tab: 'pipeline',    label: terminology.pipeline    || 'Pipeline',    icon: 'pipeline',    crm: true },
    { tab: 'diary',       label: terminology.diary       || 'Diary',       icon: 'calendar',    crm: true },
    { tab: 'customers',   label: terminology.customers   || 'Customers',   icon: 'users',       crm: true },
    { tab: 'reports',     label: terminology.reports     || 'Reports',     icon: 'chart',       crm: true },
    { tab: 'leads',       label: terminology.leads       || 'Leads',       icon: 'inbox',       crm: false },
    { tab: 'automations', label: 'Automations',                            icon: 'automations', crm: false },
    { tab: 'website',     label: 'Website',                                icon: 'website',     crm: false },
    { tab: 'social',      label: 'Social',                                 icon: 'social',      crm: false },
    { tab: 'whatsapp',    label: 'WhatsApp',                               icon: 'whatsapp',    crm: false },
    { tab: 'media',       label: 'Media Library',                          icon: 'media',       crm: false },
    { tab: 'settings',    label: 'Settings',                               icon: 'settings',    crm: false },
  ];

  const dealHasBooking = (dealId: string) => events.some((e) => e.deal_id === dealId);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ==================== SIDEBAR ==================== */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0a0f1c] text-white flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            {pdfBranding?.logo_url ? (
              <img src={pdfBranding.logo_url} alt={company.name} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain', flexShrink: 0, background: 'rgba(255,255,255,0.1)' }} />
            ) : (
              <div style={{ width: '36px', height: '36px', background: '#0F6E56', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '14px', color: '#fff', fontWeight: 700 }}>
                  {(company.company_name || company.name || '?').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
<div>
  <h1 className="font-bold text-lg tracking-wide" style={{ color: '#fff' }}>
    {company.company_name || company.name}
  </h1>
  <p className="text-xs text-gray-400 truncate">
    Dashboard
  </p>
</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.tab}
              onClick={() => {
  if (item.tab === 'settings') {
    router.push('/company-dashboard/settings');
    setSidebarOpen(false);
  } else if (item.tab === 'automations') {
    router.push('/company-dashboard/automations');
    setSidebarOpen(false);
  } else if (item.tab === 'website') {
    router.push('/company-dashboard/website');
    setSidebarOpen(false);
  } else if (item.tab === 'social') {
    router.push('/company-dashboard/social');
    setSidebarOpen(false);
  } else if (item.tab === 'whatsapp') {
    router.push('/company-dashboard/whatsapp');
    setSidebarOpen(false);
  } else if (item.tab === 'media') {
    router.push('/company-dashboard/media');
    setSidebarOpen(false);
  } else {
    setActiveTab(item.tab);
    setSidebarOpen(false);
    setShowQuoteBuilder(false);
    setQuotePrefill(null);
  }
}}
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

          <div className="pt-3 mt-3 border-t border-white/10">
            <button
              onClick={() => { router.push('/company-dashboard/import'); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="flex-1 text-left">Import Data</span>
            </button>
            <button
              onClick={() => { router.push('/company-dashboard/team'); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="flex-1 text-left">Team</span>
            </button>
          </div>
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
                onClickQuote={(q) => { setSelectedQuote(q); setShowQuoteDetail(true); }}
                pdfBranding={pdfBranding}
              />
         )}
            {activeTab === 'quotes' && showQuoteBuilder && quoteBuilderType === 'removals' && (
              <QuoteBuilder company={company} onSave={saveQuoteFromBuilder} onCancel={() => { setShowQuoteBuilder(false); setQuotePrefill(null); }} prefill={quotePrefill} pdfBranding={pdfBranding} pricingConfig={pricingConfig} />
            )}
            {activeTab === 'quotes' && showQuoteBuilder && quoteBuilderType === 'trades' && (
              <TradesQuoteBuilder company={company} onSave={saveQuoteFromBuilder} onCancel={() => { setShowQuoteBuilder(false); setQuotePrefill(null); }} prefill={quotePrefill} pdfBranding={pdfBranding} />
            )}
            {activeTab === 'quotes' && showQuoteBuilder && quoteBuilderType === 'simple' && (
              <SimpleQuoteBuilder company={company} onSave={saveQuoteFromBuilder} onCancel={() => { setShowQuoteBuilder(false); setQuotePrefill(null); }} prefill={quotePrefill} pdfBranding={pdfBranding} />
            )}
              {activeTab === 'pipeline' && (
              <PipelineTab
                pipelines={pipelines}
                activePipelineId={activePipelineId}
                onSwitchPipeline={setActivePipelineId}
                onCreatePipeline={createPipeline}
                onRenamePipeline={renamePipeline}
                onDeletePipeline={deletePipeline}
                stages={stages.filter(s => s.pipeline_id === activePipelineId)}
                deals={deals.filter(d => d.pipeline_id === activePipelineId || (!d.pipeline_id && stages.filter(s => s.pipeline_id === activePipelineId).some(s => s.id === d.stage_id)))}
                events={events}
                onMoveDeal={moveDeal}
                onEditDeal={(deal) => { setEditingDeal(deal); setShowDealModal(true); }}
                onDeleteDeal={deleteDeal}
                onClickDeal={(deal) => openCustomerFromDeal(deal)}
                dealHasBooking={dealHasBooking}
                onBulkEmail={(recipients) => { setBulkEmailRecipients(recipients); setShowBulkEmail(true); }}
                onManageStages={() => setShowStageManager(true)}
                tasks={allCompanyTasks}
                customers={customers}
                onOpenCustomerDetail={(customer) => openCustomerDetail(customer)}
              />
            )}
            {activeTab === 'diary' && (
              <DiaryTab
                events={events}
                deals={deals}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onAddEvent={(prefillDate) => { setEditingEvent(null); setEventPrefillDate(prefillDate || null); setShowEventModal(true); }}
                onEditEvent={(event) => { setEditingEvent(event); setShowEventModal(true); }}
                onDeleteEvent={deleteEvent}
                onToggleComplete={toggleEventComplete}
                onClickEvent={(event) => { setSelectedEvent(event); setShowEventDetail(true); }}
                onRescheduleEvent={rescheduleEvent}
                customEventTypes={customEventTypes}
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
                onSendQuoteLink={sendQuoteLink}
                crmQuotes={crmQuotes}
                onClickQuote={(q) => { setSelectedQuote(q); setShowQuoteDetail(true); }}
                emailConnected={emailConnected}
                onComposeEmail={(customer) => { setComposeEmailCustomer(customer); setShowComposeEmail(true); }}
                onClickCustomer={openCustomerDetail}
                stages={stages}
                company={company}
              />
            )}
            {activeTab === 'whatsapp' && (
              <div style={{ margin: '-32px', height: 'calc(100vh)' }}>
                <iframe src="/company-dashboard/whatsapp" style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            )}
            {activeTab === 'reports' && (
              <ReportsTab leads={leads} deals={deals} customers={customers} events={events} crmQuotes={crmQuotes} company={company} costs={crmCosts} onAddCost={addCost} onUpdateCost={updateCost} onDeleteCost={deleteCost} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab company={company} crmActive={crmActive} onSubscribe={startCrmSubscription} emailConnected={emailConnected} emailAddress={emailAddress} emailLoading={emailLoading} onDisconnectEmail={disconnectEmail} pdfBranding={pdfBranding} onSavePdfBranding={async (branding: any) => { const { error } = await supabase.from('company_config').upsert({ company_id: company.id, pdf_template: branding }, { onConflict: 'company_id' }); if (!error) setPdfBranding(branding); return { error }; }} customEventTypes={customEventTypes} onSaveEventTypes={saveCustomEventTypes} customCustomerFields={customCustomerFields} onSaveCustomerFields={saveCustomCustomerFields} customSources={customSources} onSaveSources={saveCustomSources} />
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
          onClose={() => { setShowEventModal(false); setEditingEvent(null); setEventPrefillDate(null); }}
          emailConnected={emailConnected}
          prefillDate={eventPrefillDate}
          eventTypes={customEventTypes}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          customer={editingCustomer}
          stages={stages}
          onSave={saveCustomer}
          onClose={() => { setShowCustomerModal(false); setEditingCustomer(null); }}
          customFields={customCustomerFields}
          customSources={customSources}
        />
      )}

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
          onDayPlan={() => { setShowDayPlan(true); }}
          onPrintInvoice={() => downloadInvoicePdf({
            companyName: company?.name || 'MOVCO',
            companyEmail: company?.email || '',
            companyPhone: company?.phone || '',
            invoiceRef: `INV-${selectedDeal.id.slice(0, 8).toUpperCase()}`,
            invoiceDate: new Date().toLocaleDateString('en-GB'),
            dueDate: selectedDeal.moving_date ? new Date(selectedDeal.moving_date).toLocaleDateString('en-GB') : undefined,
            customerName: selectedDeal.customer_name,
            customerEmail: selectedDeal.customer_email || '',
            customerPhone: selectedDeal.customer_phone || '',
            movingFrom: selectedDeal.moving_from || '',
            movingTo: selectedDeal.moving_to || '',
            movingDate: selectedDeal.moving_date || '',
            estimatedPrice: selectedDeal.estimated_value || 0,
            notes: selectedDeal.notes || '',
            branding: pdfBranding,
          })}
        />
      )}

      {showQuickBookModal && selectedDeal && (
        <QuickBookEventModal
          deal={selectedDeal}
          onSave={(event) => { quickBookEvent(event); setShowDealDetail(false); setSelectedDeal(null); }}
          onClose={() => setShowQuickBookModal(false)}
          eventTypes={customEventTypes}
        />
      )}

      {showQuoteDetail && selectedQuote && (
        <QuoteDetailPopup
          quote={selectedQuote}
          company={company}
          pdfBranding={pdfBranding}
          pricingConfig={pricingConfig}
          onClose={() => { setShowQuoteDetail(false); setSelectedQuote(null); }}
          onUpdateStatus={(status) => { updateQuoteStatus(selectedQuote.id, status); setSelectedQuote({ ...selectedQuote, status } as CrmQuote); }}
          onDelete={() => { deleteQuote(selectedQuote.id); setShowQuoteDetail(false); setSelectedQuote(null); }}
          onConvertToDeal={() => { convertQuoteToDeal(selectedQuote); setShowQuoteDetail(false); setSelectedQuote(null); }}
          onSave={async (fields) => { await updateQuoteFields(selectedQuote.id, fields); setSelectedQuote({ ...selectedQuote, ...fields } as CrmQuote); }}
          onDayPlan={selectedQuote?.deal_id ? () => { setShowQuoteDetail(false); const d = deals.find(x => x.id === selectedQuote!.deal_id); if (d) { setSelectedDeal(d); setShowDayPlan(true); } } : undefined}
          onBookDiary={(q) => {
            setShowQuoteDetail(false);
            setQuotePrefill({
              customer_name: q.customer_name,
              customer_email: q.customer_email || '',
              customer_phone: q.customer_phone || '',
              moving_from: q.moving_from || '',
              moving_to: q.moving_to || '',
              moving_date: q.moving_date || '',
              notes: q.notes || '',
              deal_id: q.deal_id || null,
            });
            setActiveTab('diary');
            setEditingEvent(null);
            setEventPrefillDate(q.moving_date ? new Date(q.moving_date) : new Date());
            setShowEventModal(true);
          }}
        />
      )}
      {showCustomerDetail && selectedCustomer && (
        <CustomerDetailPopup
          customer={selectedCustomer}
          notes={customerNotes}
          tasks={customerTasks}
          files={customerFiles}
          deal={detailDeal}
          stages={stages}
          onClose={() => { setShowCustomerDetail(false); setSelectedCustomer(null); setCustomerNotes([]); setCustomerTasks([]); setCustomerFiles([]); setDetailDeal(null); }}
          onAddNote={(text) => addCustomerNote(selectedCustomer.id, text)}
          onDeleteNote={deleteCustomerNote}
          onAddTask={(title, dueDate) => addCustomerTask(selectedCustomer.id, title, dueDate)}
          onToggleTask={toggleCustomerTask}
          onDeleteTask={deleteCustomerTask}
          onUploadFile={(file) => uploadCustomerFile(selectedCustomer.id, file)}
          onDeleteFile={deleteCustomerFile}
          onEditCustomer={() => { setShowCustomerDetail(false); setEditingCustomer(selectedCustomer); setShowCustomerModal(true); }}
          onComposeEmail={() => { setComposeEmailCustomer(selectedCustomer); setShowComposeEmail(true); }}
          emailConnected={emailConnected}
          onSchedule={detailDeal ? () => { setSelectedDeal(detailDeal); setShowCustomerDetail(false); setShowQuickBookModal(true); } : undefined}
          onBookEvent={() => { setShowCustomerDetail(false); setEditingEvent(null); setEventPrefillDate(new Date()); setShowEventModal(true); }}
          onCreateQuote={detailDeal ? () => { openQuoteFromDeal(detailDeal); setShowCustomerDetail(false); } : undefined}
          onDeleteDeal={detailDeal ? () => { deleteDeal(detailDeal.id); setShowCustomerDetail(false); } : undefined}
          onDayPlan={detailDeal ? () => { setShowCustomerDetail(false); setSelectedDeal(detailDeal); setShowDayPlan(true); } : undefined}
          onPrintInvoice={detailDeal ? () => downloadInvoicePdf({
            companyName: company?.name || 'MOVCO',
            companyEmail: company?.email || '',
            companyPhone: company?.phone || '',
            invoiceRef: `INV-${detailDeal.id.slice(0, 8).toUpperCase()}`,
            invoiceDate: new Date().toLocaleDateString('en-GB'),
            dueDate: detailDeal.moving_date ? new Date(detailDeal.moving_date).toLocaleDateString('en-GB') : undefined,
            customerName: selectedCustomer.name,
            customerEmail: selectedCustomer.email || '',
            customerPhone: selectedCustomer.phone || '',
            movingFrom: selectedCustomer.moving_from || detailDeal.moving_from || '',
            movingTo: selectedCustomer.moving_to || detailDeal.moving_to || '',
            movingDate: detailDeal.moving_date || '',
            estimatedPrice: detailDeal.estimated_value || 0,
            notes: detailDeal.notes || '',
            branding: pdfBranding,
          }) : undefined}
          events={events}
          quotes={crmQuotes.filter(q => q.customer_name.toLowerCase() === selectedCustomer.name.toLowerCase())}
          onClickQuote={(q) => { setShowCustomerDetail(false); setSelectedQuote(q); setShowQuoteDetail(true); }}
          customFields={customCustomerFields}
        />
      )}
      {showComposeEmail && composeEmailCustomer && (

        <ComposeEmailModalMain
          customer={composeEmailCustomer}
          emailConnected={emailConnected}
          companyId={company.id}
          onClose={() => { setShowComposeEmail(false); setComposeEmailCustomer(null); }}
        />
      )}
{showStageManager && (
        <StageManagerModal
          stages={stages}
          deals={deals}
          onClose={() => setShowStageManager(false)}
          onAddStage={addPipelineStage}
          onUpdateStage={updatePipelineStage}
          onReorderStages={reorderPipelineStages}
          onDeleteStage={deletePipelineStage}
        />
      )}
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
      {showBulkEmail && (
        <BulkEmailModal
          recipients={bulkEmailRecipients}
          emailConnected={emailConnected}
          companyId={company.id}
          onClose={() => { setShowBulkEmail(false); setBulkEmailRecipients([]); }}
        />
      )}
      {showDayPlan && selectedDeal && (
        <DayPlanModal
          deal={selectedDeal}
          onClose={() => setShowDayPlan(false)}
        />
      )}
      <AiAssistant />
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
    automations: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>),
    website: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>),
     whatsapp: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>),social: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>),
     media: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>),
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
// AI QUOTE BUILDER — with editable inventory
// ============================================

function QuoteBuilder({ company, onSave, onCancel, prefill, pdfBranding, pricingConfig }: {
  company: Company;
  onSave: (q: Partial<CrmQuote>) => void;
  onCancel: () => void;
  prefill?: QuotePrefill | null;
  pdfBranding?: any;
  pricingConfig?: any;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'details' | 'photos' | 'analyzing' | 'results'>(prefill ? 'photos' : 'details');

  const [customerName, setCustomerName] = useState(prefill?.customer_name || '');
  const [customerEmail, setCustomerEmail] = useState(prefill?.customer_email || '');
  const [customerPhone, setCustomerPhone] = useState(prefill?.customer_phone || '');
  const [movingFrom, setMovingFrom] = useState(prefill?.moving_from || '');
  const [movingTo, setMovingTo] = useState(prefill?.moving_to || '');
  const [movingDate, setMovingDate] = useState(prefill?.moving_date || '');
  const [notes, setNotes] = useState(prefill?.notes || '');

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [aiResult, setAiResult] = useState<any>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

 const [editItems, setEditItems] = useState<any[]>([]);
  const [editPrice, setEditPrice] = useState('');
  const [editVolume, setEditVolume] = useState('');
  const [editVans, setEditVans] = useState('1');
  const [editMovers, setEditMovers] = useState('2');
  const [editDistance, setEditDistance] = useState('');
  const [editHours, setEditHours] = useState('');

  // Inventory editor state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemVolume, setCustomItemVolume] = useState('');

  // Cost breakdown state
  // Additional services
  const [additionalServices, setAdditionalServices] = useState<{ name: string; price: number }[]>([]);
  const PRESET_SERVICES = [
    { name: 'Packing Service', price: 150 },
    { name: 'Unpacking Service', price: 150 },
    { name: 'Furniture Disassembly', price: 100 },
    { name: 'Furniture Reassembly', price: 100 },
    { name: 'Mattress Bags', price: 30 },
    { name: 'Packing Materials', price: 75 },
    { name: 'Piano Move', price: 200 },
    { name: 'Short-Term Storage', price: 0 },
  ];
  const servicesTotal = additionalServices.reduce((s, x) => s + x.price, 0);
  const [costBreakdown, setCostBreakdown] = useState<{ category: string; description: string; amount: string }[]>([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [newCostCategory, setNewCostCategory] = useState('fuel');
  const [newCostDesc, setNewCostDesc] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const autoGenerateCosts = (vans: string, movers: string, hours: string, distance: string) => {
    const costs: { category: string; description: string; amount: string }[] = [];
    const rate = pricingConfig?.hourly_rate || 45;
    const fuelRate = pricingConfig?.fuel_rate_per_mile || 0.50;
    const vanRate = pricingConfig?.van_cost_per_day || 75;
    const m = parseInt(movers) || 2;
    const h = parseFloat(hours) || 0;
    const d = parseFloat(distance) || 0;
    const v = parseInt(vans) || 1;
    if (m > 0 && h > 0) {
      costs.push({ category: 'labour', description: `${m} movers × ${h}hrs × £${rate}/hr`, amount: (m * h * rate).toFixed(2) });
    }
    if (v > 0 && vanRate > 0) {
      costs.push({ category: 'vehicle', description: `${v} van${v !== 1 ? 's' : ''} × £${vanRate}/day`, amount: (v * vanRate).toFixed(2) });
    }
    if (d > 0 && fuelRate > 0) {
      costs.push({ category: 'fuel', description: `${d} miles × £${fuelRate.toFixed(2)}/mile`, amount: (d * fuelRate).toFixed(2) });
    }
    return costs;
  };
  const COST_CATEGORIES = [
    { value: 'fuel', label: 'Fuel', icon: '⛽' },
    { value: 'labour', label: 'Labour', icon: '👷' },
    { value: 'materials', label: 'Materials', icon: '📦' },
    { value: 'packing', label: 'Packing', icon: '🎁' },
    { value: 'tolls', label: 'Tolls/Parking', icon: '🅿️' },
    { value: 'storage', label: 'Storage', icon: '🏪' },
    { value: 'subcontractor', label: 'Subcontractor', icon: '🤝' },
    { value: 'vehicle', label: 'Vehicle', icon: '🔧' },
    { value: 'other', label: 'Other', icon: '📋' },
  ];
  const totalEstCosts = costBreakdown.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const estMargin = editPrice ? (((parseFloat(editPrice) - totalEstCosts) / parseFloat(editPrice)) * 100).toFixed(1) : '0';

  const COMMON_ITEMS = [
    { name: 'Sofa - 2 Seater', note: '~35 ft³' },{ name: 'Sofa - 3 Seater', note: '~45 ft³' },{ name: 'Sofa - Corner/L-Shape', note: '~60 ft³' },{ name: 'Armchair', note: '~20 ft³' },{ name: 'Coffee Table', note: '~10 ft³' },{ name: 'TV Unit / Stand', note: '~15 ft³' },{ name: 'Bookcase', note: '~25 ft³' },{ name: 'Sideboard', note: '~25 ft³' },{ name: 'Display Cabinet', note: '~30 ft³' },{ name: 'Single Bed + Mattress', note: '~40 ft³' },{ name: 'Double Bed + Mattress', note: '~55 ft³' },{ name: 'King Bed + Mattress', note: '~65 ft³' },{ name: 'Super King Bed + Mattress', note: '~75 ft³' },{ name: 'Wardrobe - Single', note: '~35 ft³' },{ name: 'Wardrobe - Double', note: '~65 ft³' },{ name: 'Chest of Drawers', note: '~20 ft³' },{ name: 'Bedside Table', note: '~5 ft³' },{ name: 'Dressing Table', note: '~15 ft³' },{ name: 'Fridge Freezer', note: '~30 ft³' },{ name: 'American Fridge Freezer', note: '~40 ft³' },{ name: 'Washing Machine', note: '~30 ft³' },{ name: 'Tumble Dryer', note: '~25 ft³' },{ name: 'Dishwasher', note: '~25 ft³' },{ name: 'Microwave', note: '~5 ft³' },{ name: 'Dining Table - 4 Seat', note: '~20 ft³' },{ name: 'Dining Table - 6 Seat', note: '~30 ft³' },{ name: 'Dining Chair', note: '~5 ft³' },{ name: 'China Cabinet', note: '~35 ft³' },{ name: 'Office Desk', note: '~20 ft³' },{ name: 'Office Chair', note: '~10 ft³' },{ name: 'Filing Cabinet', note: '~15 ft³' },{ name: 'Patio Table + 4 Chairs', note: '~25 ft³' },{ name: 'BBQ', note: '~15 ft³' },{ name: 'Lawnmower', note: '~10 ft³' },{ name: 'Small Box (Book Box)', note: '~2 ft³' },{ name: 'Medium Box', note: '~3 ft³' },{ name: 'Large Box', note: '~5 ft³' },{ name: 'Wardrobe Box', note: '~10 ft³' },{ name: 'Bicycle', note: '~10 ft³' },{ name: 'Piano - Upright', note: '~50 ft³' },{ name: 'Exercise Bike / Treadmill', note: '~20 ft³' },{ name: 'Trampoline', note: '~20 ft³' },
  ];

  const parseItemVolume = (note: string) => {
    const match = note?.match(/~?(\d+(?:\.\d+)?)\s*ft/);
    return match ? parseFloat(match[1]) : 0;
  };

  const removeEditItem = (idx: number) => {
    setEditItems((prev: any[]) => prev.filter((_: any, i: number) => i !== idx));
  };

  const updateEditItemQuantity = (idx: number, delta: number) => {
    setEditItems((prev: any[]) => prev.map((item: any, i: number) =>
      i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const addCommonItem = (common: { name: string; note: string }) => {
    const existing = editItems.findIndex((i: any) => i.name.toLowerCase() === common.name.toLowerCase());
    if (existing >= 0) {
      updateEditItemQuantity(existing, 1);
    } else {
      setEditItems((prev: any[]) => [...prev, { name: common.name, note: common.note, quantity: 1 }]);
    }
    setShowAddItemModal(false);
    setItemSearch('');
  };

  const addCustomItem = () => {
    if (!customItemName.trim()) return;
    const vol = parseFloat(customItemVolume) || 10;
    setEditItems((prev: any[]) => [...prev, { name: customItemName.trim(), note: `~${vol} ft³`, quantity: 1 }]);
    setCustomItemName('');
    setCustomItemVolume('');
    setShowAddItemModal(false);
  };

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

  const uploadAndAnalyze = async () => {
    if (files.length === 0) { alert('Please upload at least one photo'); return; }
    if (!movingFrom.trim() || !movingTo.trim()) { alert('Please enter moving from and moving to addresses'); return; }

    setStep('analyzing');
    setAnalyzeError(null);

    try {
      const urls: string[] = [];
      for (const file of files) {
        const filePath = `crm-quotes/${company.id}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('movco-photos').upload(filePath, file);

        if (uploadError) {
          const { data: uploadData2, error: uploadError2 } = await supabase.storage.from('photos').upload(filePath, file);
          if (uploadError2) { console.error('Upload error:', uploadError2); continue; }
          const { data: pubData2 } = supabase.storage.from('photos').getPublicUrl(filePath);
          if (pubData2?.publicUrl) urls.push(pubData2.publicUrl);
        } else {
          const { data: pubData } = supabase.storage.from('movco-photos').getPublicUrl(filePath);
          if (pubData?.publicUrl) urls.push(pubData.publicUrl);
        }
      }

      setUploadedUrls(urls);
      if (urls.length === 0) throw new Error('Failed to upload photos. Please try again.');

      const response = await fetch('https://movco-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starting_address: movingFrom, ending_address: movingTo, photo_urls: urls }),
      });

      if (!response.ok) throw new Error(`Analysis failed (${response.status}). Please try again.`);

      const data = await response.json();
      setAiResult(data);
      setEditItems(data.items || []);
      setEditPrice(data.estimate?.toFixed(2) || '');
      setEditVolume(data.totalVolumeM3?.toString() || '');
      const vol = data.totalVolumeM3 || 0;
      setEditVans(vol <= 15 ? '1' : vol <= 30 ? '2' : '3');
      setEditMovers(vol <= 15 ? '2' : vol <= 30 ? '3' : '4');
      const estHours = vol <= 10 ? '3' : vol <= 20 ? '5' : vol <= 35 ? '7' : '9';
      setEditHours(estHours);
      // Try to get distance from AI response, otherwise calculate via Google Geocoding
      let estDist = data.distanceMiles?.toString() || data.distance_miles?.toString() || '';
      if (!estDist && movingFrom && movingTo) {
        try {
          const geocode = async (addr: string) => {
            const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`);
            const d = await r.json();
            if (d.results?.[0]?.geometry?.location) return d.results[0].geometry.location;
            return null;
          };
          const from = await geocode(movingFrom);
          const to = await geocode(movingTo);
          if (from && to) {
            const R = 3958.8;
            const dLat = (to.lat - from.lat) * Math.PI / 180;
            const dLon = (to.lng - from.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            estDist = (R * c * 1.3).toFixed(1);
          }
        } catch (err) {
          console.error('Distance calc error:', err);
        }
      }
      setEditDistance(estDist);
      // Auto-generate cost breakdown
      const vansEst = vol <= 15 ? '1' : vol <= 30 ? '2' : '3';
      const moversEst = vol <= 15 ? '2' : vol <= 30 ? '3' : '4';
      setCostBreakdown(autoGenerateCosts(vansEst, moversEst, estHours, estDist));
      setStep('results');
    } catch (err: any) {
      console.error('Analyze error:', err);
      setAnalyzeError(err?.message || 'Something went wrong. Please try again.');
      setStep('photos');
    }
  };

  const handleSaveQuote = () => {
    if (!customerName.trim()) { alert('Please enter a customer name'); return; }
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
      distance_miles: editDistance ? parseFloat(editDistance) : null,
      estimated_hours: editHours ? parseFloat(editHours) : null,
      cost_breakdown: costBreakdown.filter(c => parseFloat(c.amount) > 0).map(c => ({ category: c.category, description: c.description, amount: parseFloat(c.amount) })),
      notes: notes || null,
      additional_services: additionalServices.length > 0 ? additionalServices : null,
      status: 'draft',
      deal_id: prefill?.deal_id || null,
    } as any);
  };

  const steps = [
    { key: 'details', label: 'Customer Details' },
    { key: 'photos', label: 'Upload Photos' },
    { key: 'results', label: 'Review & Save' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">New AI Quote</h2>
            <p className="text-sm text-gray-500">{prefill ? `Pre-filled for ${prefill.customer_name}` : 'Upload photos for AI-powered item detection & pricing'}</p>
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

      {/* STEP 1: Customer Details */}
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
          <button onClick={() => { if (!customerName.trim()) return alert('Customer name is required'); if (!movingFrom.trim() || !movingTo.trim()) return alert('Moving from and moving to are required'); setStep('photos'); }} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg">
            Next — Upload Photos →
          </button>
        </div>
      )}

      {/* STEP 2: Photo Upload */}
      {step === 'photos' && (
        <div className="space-y-6">
          {prefill && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <div><p className="font-semibold text-blue-900">{customerName}</p><p className="text-sm text-blue-700">{movingFrom} → {movingTo}</p></div>
              <button onClick={() => setStep('details')} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 bg-white rounded-lg border border-blue-200">Edit Details</button>
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
                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <p className="font-medium text-gray-800">Take Photo</p><p className="text-xs text-gray-500 mt-0.5">Use your camera</p>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleCameraChange} className="hidden" />
              </label>
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-green-400 hover:bg-green-50/50 transition-all">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <p className="font-medium text-gray-800">Upload Photos</p><p className="text-xs text-gray-500 mt-0.5">Choose from gallery</p>
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
                      <button onClick={() => removeFile(idx)} className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
            <button onClick={uploadAndAnalyze} disabled={files.length === 0} className={`flex-1 font-semibold py-3.5 rounded-xl transition text-lg ${files.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'}`}>
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Analyze with AI ({files.length} photo{files.length !== 1 ? 's' : ''})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ANALYZING STATE */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 animate-pulse shadow-2xl">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Analyzing Photos...</h3>
          <p className="text-gray-500 text-sm mb-6">Our AI is detecting items and calculating volumes</p>
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
            <span className="text-blue-600 font-medium text-sm">This usually takes 30-60 seconds...</span>
          </div>
        </div>
      )}

      {/* STEP 3: Results with editable inventory */}
      {step === 'results' && aiResult && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm text-blue-200">AI Estimated Cost</p><p className="text-4xl font-bold">£{parseFloat(editPrice || '0').toFixed(2)}</p></div>
              <div className="text-right"><p className="text-sm text-blue-200">Customer</p><p className="text-lg font-semibold">{customerName}</p></div>
            </div>
            <p className="text-sm text-blue-200">{movingFrom} → {movingTo}</p>
          </div>

          <div className="bg-white rounded-xl border p-6">
            <h3 className="font-bold text-gray-900 mb-4">Adjust Pricing & Logistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div><label className="text-xs text-gray-500 mb-1 block">Volume (m³)</label><input type="number" value={editVolume} onChange={(e) => setEditVolume(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Vans</label><input type="number" value={editVans} onChange={(e) => { setEditVans(e.target.value); setCostBreakdown(autoGenerateCosts(e.target.value, editMovers, editHours, editDistance)); }} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" min="1" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Movers</label><input type="number" value={editMovers} onChange={(e) => { setEditMovers(e.target.value); setCostBreakdown(autoGenerateCosts(editVans, e.target.value, editHours, editDistance)); }} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" min="1" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Est. Hours</label><input type="number" step="0.5" value={editHours} onChange={(e) => { setEditHours(e.target.value); setCostBreakdown(autoGenerateCosts(editVans, editMovers, e.target.value, editDistance)); }} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" min="1" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Distance (miles)</label><input type="number" value={editDistance} onChange={(e) => { setEditDistance(e.target.value); setCostBreakdown(autoGenerateCosts(editVans, editMovers, editHours, e.target.value)); }} className="w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Your Price (£)</label><input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm font-bold text-green-600 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
          </div>
    {/* ADDITIONAL SERVICES */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Additional Services</h3>
                <p className="text-xs text-gray-500 mt-0.5">Added to the customer quote price</p>
              </div>
              {servicesTotal > 0 && <span className="text-sm font-bold text-blue-600">+£{servicesTotal}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_SERVICES.map((svc, i) => {
                const active = additionalServices.some(s => s.name === svc.name);
                return (
                  <button key={i}
                    onClick={() => {
                      if (active) {
                        setAdditionalServices(prev => prev.filter(s => s.name !== svc.name));
                        setEditPrice(prev => String((parseFloat(prev) - svc.price).toFixed(2)));
                      } else {
                        setAdditionalServices(prev => [...prev, svc]);
                        setEditPrice(prev => String((parseFloat(prev) + svc.price).toFixed(2)));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400'}`}>
                    {active ? '✓ ' : ''}{svc.name}{svc.price > 0 ? ` +£${svc.price}` : ' (quote)'}
                  </button>
                );
              })}
            </div>
            {additionalServices.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3 space-y-2 mt-2">
                {additionalServices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700 flex-1">{s.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">£</span>
                      <input
                        type="number"
                        value={s.price}
                        onChange={(e) => {
                          const newPrice = parseFloat(e.target.value) || 0;
                          const diff = newPrice - s.price;
                          setAdditionalServices(prev => prev.map((x, xi) => xi === i ? { ...x, price: newPrice } : x));
                          setEditPrice(prev => String((parseFloat(prev) + diff).toFixed(2)));
                        }}
                        className="w-20 px-2 py-1 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700 bg-white focus:ring-2 focus:ring-blue-400 outline-none text-right"
                      />
                      <button
                        onClick={() => {
                          setEditPrice(prev => String((parseFloat(prev) - s.price).toFixed(2)));
                          setAdditionalServices(prev => prev.filter((_, xi) => xi !== i));
                        }}
                        className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-blue-200">
                  <span className="text-sm font-semibold text-gray-700">Services Total</span>
                  <span className="text-sm font-bold text-blue-700">+£{additionalServices.reduce((s, x) => s + x.price, 0)}</span>
                </div>
              </div>
            )}
          </div>
{/* ESTIMATED COSTS */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Estimated Costs</h3>
                <p className="text-xs text-gray-500 mt-0.5">Your internal costs for this job — not shown to customer</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Est. Margin</p>
                <p className={`text-lg font-bold ${parseFloat(estMargin) >= 20 ? 'text-green-600' : parseFloat(estMargin) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{estMargin}%</p>
              </div>
            </div>
            {costBreakdown.length > 0 && (
              <div className="space-y-2 mb-4">
                {costBreakdown.map((cost, idx) => {
                  const cat = COST_CATEGORIES.find(c => c.value === cost.category) || COST_CATEGORIES[COST_CATEGORIES.length - 1];
                  return (
                    <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 group">
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-sm text-gray-700 flex-1">{cat.label}{cost.description ? ` — ${cost.description}` : ''}</span>
                      <span className="text-sm font-semibold text-red-600">£{parseFloat(cost.amount).toFixed(2)}</span>
                      <button onClick={() => setCostBreakdown(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-semibold text-gray-700">Total Costs</span>
                  <span className="text-sm font-bold text-red-600">£{totalEstCosts.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Est. Profit</span>
                  <span className={`text-sm font-bold ${(parseFloat(editPrice || '0') - totalEstCosts) >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{(parseFloat(editPrice || '0') - totalEstCosts).toFixed(2)}</span>
                </div>
              </div>
            )}
            {showCostForm ? (
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <select value={newCostCategory} onChange={e => setNewCostCategory(e.target.value)} className="px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                  <input value={newCostDesc} onChange={e => setNewCostDesc(e.target.value)} placeholder="Description" className="px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <input type="number" step="0.01" value={newCostAmount} onChange={e => setNewCostAmount(e.target.value)} placeholder="£ Amount" className="px-2 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { if (!newCostAmount || parseFloat(newCostAmount) <= 0) return; setCostBreakdown(prev => [...prev, { category: newCostCategory, description: newCostDesc, amount: newCostAmount }]); setNewCostCategory('fuel'); setNewCostDesc(''); setNewCostAmount(''); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">Add</button>
                  <button onClick={() => { setShowCostForm(false); setNewCostDesc(''); setNewCostAmount(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition">Done</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCostForm(true)} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">+ Add Estimated Cost</button>
            )}
          </div>
          {/* EDITABLE ITEMS LIST */}
          <div className="bg-white rounded-xl border">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Items ({editItems.reduce((s: number, i: any) => s + i.quantity, 0)})</h3>
                <p className="text-xs text-gray-500 mt-0.5">~{editItems.reduce((s: number, i: any) => s + parseItemVolume(i.note || '') * i.quantity, 0).toFixed(0)} ft³ total</p>
              </div>
              <button onClick={() => setShowAddItemModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">+ Add Item</button>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {editItems.map((item: any, idx: number) => (
                <div key={idx} className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 group">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.note}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => updateEditItemQuantity(idx, -1)} className="w-7 h-7 rounded-md border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm font-bold">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                    <button onClick={() => updateEditItemQuantity(idx, 1)} className="w-7 h-7 rounded-md border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm font-bold">+</button>
                  </div>
                  <span className="text-xs text-gray-400 w-14 text-right flex-shrink-0">{(parseItemVolume(item.note || '') * item.quantity).toFixed(0)} ft³</span>
                  <button onClick={() => removeEditItem(idx)} className="w-7 h-7 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add Item Modal */}
          {showAddItemModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddItemModal(false); setItemSearch(''); }}>
              <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b">
                  <h3 className="font-bold text-gray-900 text-lg">Add Item</h3>
                  <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search common items..." autoFocus className="w-full mt-3 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="overflow-y-auto flex-1 divide-y">
                  {COMMON_ITEMS.filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map((item, idx) => (
                    <button key={idx} onClick={() => addCommonItem(item)} className="w-full px-5 py-3 text-left hover:bg-blue-50 flex items-center justify-between transition">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-400">{item.note}</span>
                    </button>
                  ))}
                  {COMMON_ITEMS.filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                    <div className="px-5 py-6 text-center text-gray-400 text-sm">No matching items. Add a custom item below.</div>
                  )}
                </div>
                <div className="px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Or add a custom item:</p>
                  <div className="flex gap-2">
                    <input value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} placeholder="Item name" className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    <input value={customItemVolume} onChange={(e) => setCustomItemVolume(e.target.value)} placeholder="ft³" type="number" className="w-16 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    <button onClick={addCustomItem} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">Add</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {uploadedUrls.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold text-gray-900 mb-4">Photos ({uploadedUrls.length})</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {uploadedUrls.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden border"><img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" /></div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('photos')} className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
            <button onClick={async () => {
              await downloadQuotePdf({
                companyName: company?.name || 'Moving Company', companyEmail: company?.email || undefined, companyPhone: company?.phone || undefined,
                quoteDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), status: 'draft',
                customerName, customerEmail: customerEmail || undefined, customerPhone: customerPhone || undefined,
                movingFrom: movingFrom || undefined, movingTo: movingTo || undefined, movingDate: movingDate || undefined,
                items: editItems || [], totalVolume: editVolume ? parseFloat(editVolume) : undefined, vanCount: editVans ? parseInt(editVans) : undefined,
                movers: editMovers ? parseInt(editMovers) : undefined, estimatedPrice: editPrice ? parseFloat(editPrice) : undefined, notes: notes || undefined,
                branding: pdfBranding || {},
              });
            }} className="px-6 py-3.5 bg-blue-50 text-blue-600 font-semibold rounded-xl hover:bg-blue-100 transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              PDF
            </button>
            <button onClick={handleSaveQuote} className="flex-1 bg-green-600 text-white font-semibold py-3.5 rounded-xl hover:bg-green-700 transition text-lg shadow-lg">
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const filtered = leads.filter(lead => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (lead.instant_quotes?.starting_address || '').toLowerCase().includes(q) || 
             (lead.instant_quotes?.ending_address || '').toLowerCase().includes(q) ||
             false;
    }
    return true;
  });

  const statusCounts = { all: leads.length, new: leads.filter(l => l.status === 'new').length, won: leads.filter(l => l.status === 'won').length, lost: leads.filter(l => l.status === 'lost').length };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <p className="text-sm text-gray-500 mt-0.5">{leads.length} total • Balance: <span className="font-semibold text-blue-600">£{company.balance?.toFixed(2) || '0.00'}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search leads..." 
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
          </div>
          {/* View toggles */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('cards')} className={`p-2 transition ${viewMode === 'cards' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 transition ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
          </div>
          <Link href="/company-dashboard/topup" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Top Up
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {(['all', 'new', 'won', 'lost'] as const).map(status => (
          <button key={status} onClick={() => setStatusFilter(status)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              statusFilter === status ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${statusFilter === status ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">{searchQuery ? 'No matching leads' : 'No leads yet'}</h3>
          <p className="text-gray-500 text-sm">Leads will appear here when customers in your postcode areas request quotes.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((lead) => (
            <Link key={lead.id} href={`/company-dashboard/lead/${lead.id}`} className="block">
              <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-lg hover:border-gray-200 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      lead.status === 'new' ? 'bg-green-100 text-green-700' : lead.status === 'won' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {(lead.instant_quotes?.starting_address?.charAt(0) || 'L')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{lead.instant_quotes?.starting_address?.split(',')[0] || 'Lead'}</p>
                      <p className="text-[11px] text-gray-400">{new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${
                    lead.status === 'new' ? 'bg-green-50 text-green-700' : lead.status === 'won' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                  }`}>{lead.status}</span>
                </div>
                <div className="text-xs text-gray-500 mb-2 truncate">
                  {lead.instant_quotes?.starting_address || 'Unknown'} → {lead.instant_quotes?.ending_address || 'Unknown'}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-green-600">£{lead.price?.toFixed(2)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Route</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Value</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => window.location.href = `/company-dashboard/lead/${lead.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        lead.status === 'new' ? 'bg-green-100 text-green-700' : lead.status === 'won' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>{(lead.instant_quotes?.starting_address?.charAt(0) || 'L')[0].toUpperCase()}</div>
                      <span className="font-medium text-gray-900">{lead.instant_quotes?.starting_address?.split(',')[0] || 'Lead'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell truncate max-w-[200px]">{lead.instant_quotes?.starting_address} → {lead.instant_quotes?.ending_address}</td>
                  <td className="px-4 py-3 font-bold text-green-600">£{lead.price?.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                      lead.status === 'new' ? 'bg-green-50 text-green-700' : lead.status === 'won' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>{lead.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
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
// QUOTES TAB — with clickable cards
// ============================================

function QuotesTab({ quotes, company, onAddQuote, onDeleteQuote, onUpdateStatus, onConvertToDeal, onClickQuote, pdfBranding }: {
  quotes: CrmQuote[];
  company: Company;
  onAddQuote: () => void;
  onDeleteQuote: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onConvertToDeal: (q: CrmQuote) => void;
  onClickQuote: (q: CrmQuote) => void;
  pdfBranding?: any;
}) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleDownloadPdf = async (quote: CrmQuote) => {
    await downloadQuotePdf({
      companyName: company?.name || 'Moving Company', companyEmail: company?.email || undefined, companyPhone: company?.phone || undefined,
      quoteRef: quote.id.slice(0, 8).toUpperCase(),
      quoteDate: new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      validUntil: quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-GB') : undefined,
      status: quote.status, customerName: quote.customer_name, customerEmail: quote.customer_email || undefined,
      customerPhone: quote.customer_phone || undefined, movingFrom: quote.moving_from || undefined, movingTo: quote.moving_to || undefined,
      movingDate: quote.moving_date || undefined, items: quote.items || [], totalVolume: quote.total_volume_m3 || undefined,
      vanCount: quote.van_count || undefined, movers: quote.movers || undefined, estimatedPrice: quote.estimated_price || undefined, notes: quote.notes || undefined,
      branding: pdfBranding || {},
    });
  };

  const filtered = filterStatus === 'all' ? quotes : quotes.filter((q) => q.status === filterStatus);
  const statusCounts: Record<string, number> = { all: quotes.length, draft: quotes.filter((q) => q.status === 'draft').length, sent: quotes.filter((q) => q.status === 'sent').length, accepted: quotes.filter((q) => q.status === 'accepted').length, declined: quotes.filter((q) => q.status === 'declined').length };
  const totalQuoteValue = quotes.reduce((s, q) => s + (q.estimated_price || 0), 0);
  const acceptedValue = quotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.estimated_price || 0), 0);
  const statusStyles: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700', expired: 'bg-yellow-100 text-yellow-700' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">Quotes</h2><p className="text-sm text-gray-500 mt-1">{quotes.length} quotes • £{totalQuoteValue.toLocaleString()} total value • £{acceptedValue.toLocaleString()} accepted</p></div>
        <button onClick={onAddQuote} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>+ New AI Quote</button>
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
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">{filterStatus === 'all' ? 'No quotes yet' : `No ${filterStatus} quotes`}</h3>
          <p className="text-gray-500 text-sm mb-4">Upload photos and let AI create accurate quotes for your customers.</p>
          <button onClick={onAddQuote} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Create Your First AI Quote</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quote) => (
            <div key={quote.id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-all cursor-pointer" onClick={() => onClickQuote(quote)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{quote.customer_name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyles[quote.status] || statusStyles.draft}`}>{quote.status}</span>
                  </div>
                  {(quote.moving_from || quote.moving_to) && <p className="text-sm text-gray-600 mb-1">{quote.moving_from || '—'} → {quote.moving_to || '—'}</p>}
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
                  {quote.estimated_price && <p className="text-xl font-bold text-green-600">£{quote.estimated_price.toLocaleString()}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 flex-wrap" onClick={(e) => e.stopPropagation()}>
                {quote.status === 'draft' && <button onClick={() => onUpdateStatus(quote.id, 'sent')} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">Mark as Sent</button>}
                {quote.status === 'sent' && (
                  <>
                    <button onClick={() => onConvertToDeal(quote)} className="text-xs font-medium text-green-600 hover:text-green-800 px-3 py-1.5 bg-green-50 rounded-lg hover:bg-green-100 transition">Accepted → Pipeline</button>
                    <button onClick={() => onUpdateStatus(quote.id, 'declined')} className="text-xs font-medium text-orange-600 hover:text-orange-800 px-3 py-1.5 bg-orange-50 rounded-lg hover:bg-orange-100 transition">Declined</button>
                  </>
                )}
                <button onClick={() => handleDownloadPdf(quote)} className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>PDF
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
// PIPELINE TAB
// ============================================

function PipelineTab({ pipelines, activePipelineId, onSwitchPipeline, onCreatePipeline, onRenamePipeline, onDeletePipeline, stages, deals, events, onMoveDeal, onEditDeal, onDeleteDeal, onClickDeal, dealHasBooking, onManageStages, tasks, customers, onOpenCustomerDetail, onBulkEmail }: {
  pipelines: Pipeline[]; activePipelineId: string | null; onSwitchPipeline: (id: string) => void;
  onCreatePipeline: (name: string, color?: string) => Promise<any>;
  onRenamePipeline: (id: string, name: string) => Promise<void>;
  onDeletePipeline: (id: string) => Promise<void>;
  stages: PipelineStage[]; deals: Deal[]; events: DiaryEvent[];
  onMoveDeal: (dealId: string, stageId: string) => void;
  onEditDeal: (deal: Deal) => void; onDeleteDeal: (dealId: string) => void;
  onClickDeal: (deal: Deal) => void;
  dealHasBooking: (dealId: string) => boolean;
  onManageStages: () => void;
  tasks: CustomerTask[];
  customers: Customer[];
  onOpenCustomerDetail: (customer: Customer) => void;
  onBulkEmail: (recipients: { name: string; email: string }[]) => void;
}) {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'value' | 'date'>('newest');
  const [showTasksDropdown, setShowTasksDropdown] = useState(false);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const tasksRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tasksRef.current && !tasksRef.current.contains(e.target as Node)) {
        setShowTasksDropdown(false);
      }
    };
    if (showTasksDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTasksDropdown]);

  const hasOverdue = tasks.some(t => {
    const due = new Date(t.due_date);
    const today = new Date();
    return new Date(due.getFullYear(), due.getMonth(), due.getDate()) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  const hasDueToday = tasks.some(t => {
    const due = new Date(t.due_date);
    const today = new Date();
    return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
  });

  const getTaskColor = (dateStr: string) => {
    const due = new Date(dateStr);
    const today = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = dueDay.getTime() - todayDay.getTime();
    const diffDays = Math.round(diff / 86400000);
    if (diffDays < 0) return { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' };
    if (diffDays === 0) return { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' };
    return { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
  };

  const formatTaskDue = (dateStr: string) => {
    const due = new Date(dateStr);
    const today = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((dueDay.getTime() - todayDay.getTime()) / 86400000);
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays}d`;
    return due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const toggleDeal = (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      next.has(dealId) ? next.delete(dealId) : next.add(dealId);
      return next;
    });
  };

  const toggleStage = (stageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const stageDeals = filteredDeals(stageId);
    const stageIds = stageDeals.map(d => d.id);
    const allSelected = stageIds.every(id => selectedDealIds.has(id));
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (allSelected) { stageIds.forEach(id => next.delete(id)); }
      else { stageIds.forEach(id => next.add(id)); }
      return next;
    });
  };

  const isStageFullySelected = (stageId: string) => {
    const stageDeals = filteredDeals(stageId);
    return stageDeals.length > 0 && stageDeals.every(d => selectedDealIds.has(d.id));
  };

  const isStagePartiallySelected = (stageId: string) => {
    const stageDeals = filteredDeals(stageId);
    return stageDeals.some(d => selectedDealIds.has(d.id)) && !isStageFullySelected(stageId);
  };

  const selectedWithEmail = deals.filter(d => selectedDealIds.has(d.id) && d.customer_email);
  const selectedWithoutEmail = deals.filter(d => selectedDealIds.has(d.id) && !d.customer_email);
  const selectedCount = selectedDealIds.size;

  const totalValue = deals.reduce((s, d) => s + (d.estimated_value || 0), 0);
  const filteredDeals = (stageId: string) => {
    let stageDeals = deals.filter((d) => d.stage_id === stageId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      stageDeals = stageDeals.filter(d => 
        d.customer_name.toLowerCase().includes(q) || 
        (d.moving_from || '').toLowerCase().includes(q) || 
        (d.moving_to || '').toLowerCase().includes(q) ||
        (d.customer_email || '').toLowerCase().includes(q) ||
        (d.customer_phone || '').includes(q)
      );
    }
    if (sortBy === 'value') stageDeals.sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0));
    else if (sortBy === 'date') stageDeals.sort((a, b) => new Date(a.moving_date || '9999').getTime() - new Date(b.moving_date || '9999').getTime());
    return stageDeals;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Bar */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {pipelines.length > 1 ? (
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {pipelines.map(p => (
                    <button key={p.id} onClick={() => onSwitchPipeline(p.id)}
                      className={`px-3 py-1.5 rounded-md text-sm font-semibold transition ${
                        activePipelineId === p.id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {p.name}
                    </button>
                  ))}
                  <button onClick={() => {
                    const name = prompt('New pipeline name:');
                    if (name?.trim()) onCreatePipeline(name.trim());
                  }} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 transition text-sm" title="Add pipeline">+</button>
                </div>
              ) : (
                <h2 className="text-2xl font-bold text-gray-900">
                  {pipelines[0]?.name || 'Pipeline'}
                </h2>
              )}
              {pipelines.length <= 1 && (
                <button onClick={() => {
                  const name = prompt('New pipeline name:');
                  if (name?.trim()) onCreatePipeline(name.trim());
                }} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition" title="Add another pipeline">
                  + New Pipeline
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{deals.length} opportunities • <span className="text-green-600 font-semibold">£{totalValue.toLocaleString()}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search deals..." 
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="newest">Newest first</option>
            <option value="value">Highest value</option>
            <option value="date">Move date</option>
          </select>
          {/* Bulk Email Button */}
          <button
            onClick={() => {
              const recipients = selectedWithEmail.map(d => ({ name: d.customer_name, email: d.customer_email! }));
              onBulkEmail(recipients);
            }}
            disabled={selectedWithEmail.length === 0}
            className={`inline-flex items-center gap-2 px-3 py-2 border font-medium rounded-lg transition text-sm ${
              selectedWithEmail.length > 0
                ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
                : 'border-gray-200 text-gray-400 bg-white cursor-not-allowed'
            }`}
            title={selectedWithEmail.length === 0 ? 'Select deals to send bulk email' : `Send to ${selectedWithEmail.length} recipient${selectedWithEmail.length !== 1 ? 's' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Bulk Email
            {selectedCount > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${selectedWithEmail.length > 0 ? 'bg-white text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                {selectedWithEmail.length}{selectedWithoutEmail.length > 0 && <span className="opacity-60"> / {selectedCount}</span>}
              </span>
            )}
          </button>
          {selectedCount > 0 && (
            <button
              onClick={() => setSelectedDealIds(new Set())}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-500 font-medium rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Clear
            </button>
          )}

          {/* Tasks Button + Dropdown */}
          <div className="relative" ref={tasksRef}>
            <button
              onClick={() => setShowTasksDropdown(!showTasksDropdown)}
              className={`inline-flex items-center gap-2 px-3 py-2 border font-medium rounded-lg transition text-sm ${
                hasOverdue
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                  : hasDueToday
                  ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Tasks
              {tasks.length > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  hasOverdue ? 'bg-red-500 text-white' : hasDueToday ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}>
                  {tasks.length}
                </span>
              )}
            </button>

            {showTasksDropdown && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <h3 className="font-bold text-gray-900 text-sm">Pending Tasks</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{tasks.length} task{tasks.length !== 1 ? 's' : ''} across all customers</p>
                </div>
                {tasks.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">No pending tasks</p>
                    <p className="text-xs text-gray-300 mt-1">Tasks added to customers will appear here</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {tasks.map((task) => {
                      const colors = getTaskColor(task.due_date);
                      const customer = customers.find(c => c.id === task.customer_id);
                      return (
                        <button
                          key={task.id}
                          onClick={() => {
                            if (customer) {
                              onOpenCustomerDetail(customer);
                              setShowTasksDropdown(false);
                            }
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition ${customer ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${colors.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[11px] font-semibold ${colors.text}`}>{formatTaskDue(task.due_date)}</span>
                                {customer && (
                                  <span className="text-[11px] text-gray-400 truncate">· {customer.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

           <button
            onClick={onManageStages}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Manage Stages
          </button>
          {pipelines.length > 1 && activePipelineId && (
            <>
              <button
                onClick={() => {
                  const current = pipelines.find(p => p.id === activePipelineId);
                  const newName = prompt('Rename pipeline:', current?.name || '');
                  if (newName?.trim() && newName.trim() !== current?.name) onRenamePipeline(activePipelineId, newName.trim());
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-500 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition text-sm"
                title="Rename pipeline"
              >
                ✏️ Rename
              </button>
              <button
                onClick={() => onDeletePipeline(activePipelineId)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-500 font-medium rounded-lg hover:bg-red-50 hover:border-red-300 transition text-sm"
                title="Delete pipeline"
              >
                🗑️ Delete
              </button>
            </>
          )}
          
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><p className="text-gray-500">Ask the AI assistant to set up your pipeline — just say "set up my pipeline stages" and it will configure them for you.. Add your first deal to get started.</p></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {stages.map((stage) => {
            const stageDeals = filteredDeals(stage.id);
            const stageValue = stageDeals.reduce((s, d) => s + (d.estimated_value || 0), 0);
            return (
              <div key={stage.id} className={`flex-shrink-0 w-[280px] flex flex-col rounded-xl transition-all ${dragOverStage === stage.id ? 'ring-2 ring-blue-400' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverStage(null); if (draggedDealId) { onMoveDeal(draggedDealId, stage.id); setDraggedDealId(null); } }}>
                {/* Stage Header */}
                <div className="px-3 py-2.5 rounded-t-xl" style={{ backgroundColor: stage.color + '15', borderBottom: `2px solid ${stage.color}` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => toggleStage(stage.id, e)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isStageFullySelected(stage.id) ? 'bg-blue-500 border-blue-500'
                          : isStagePartiallySelected(stage.id) ? 'bg-blue-100 border-blue-400'
                          : 'bg-white border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {isStageFullySelected(stage.id) && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        {isStagePartiallySelected(stage.id) && <div className="w-2 h-0.5 bg-blue-500 rounded" />}
                      </button>
                      <h3 className="font-bold text-gray-800 text-[13px] truncate">{stage.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-gray-500">{stageDeals.length}</span>
                      <span className="text-[11px] text-gray-400">•</span>
                      <span className="text-xs font-semibold text-green-600">£{stageValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Deal Cards */}
                <div className={`flex-1 space-y-2 p-2 bg-gray-50/80 rounded-b-xl overflow-y-auto min-h-[100px] ${dragOverStage === stage.id ? 'bg-blue-50/50' : ''}`} style={{ maxHeight: 'calc(100vh - 250px)' }}>
                  {stageDeals.map((deal) => {
                    const hasBooking = dealHasBooking(deal.id);
                    return (
                      <div key={deal.id} draggable onDragStart={() => setDraggedDealId(deal.id)} onDragEnd={() => setDraggedDealId(null)}
                        onClick={() => onClickDeal(deal)}
                        className={`bg-white rounded-lg p-3 border cursor-pointer hover:shadow-md transition-all group ${
                          selectedDealIds.has(deal.id) ? 'border-blue-400 ring-1 ring-blue-300 shadow-sm' : 'border-gray-100 hover:border-gray-200'
                        } ${draggedDealId === deal.id ? 'opacity-40 scale-95' : ''}`}>

                        {/* Customer name & icons */}
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              onClick={(e) => deal.customer_email ? toggleDeal(deal.id, e) : e.stopPropagation()}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                !deal.customer_email ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
                                : selectedDealIds.has(deal.id) ? 'bg-blue-500 border-blue-500'
                                : 'bg-white border-gray-300 hover:border-blue-400 opacity-0 group-hover:opacity-100'
                              }`}
                              title={!deal.customer_email ? 'No email address' : selectedDealIds.has(deal.id) ? 'Deselect' : 'Select for bulk email'}
                            >
                              {selectedDealIds.has(deal.id) && deal.customer_email && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              {!deal.customer_email && <svg className="w-2 h-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
                            </button>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                              style={{ backgroundColor: stage.color + '20', color: stage.color }}>
                              {deal.customer_name.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-semibold text-gray-900 text-[13px] truncate">{deal.customer_name}</p>
                          </div>
                          {deal.estimated_value ? (
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md flex-shrink-0 ml-1">£{deal.estimated_value.toLocaleString()}</span>
                          ) : null}
                        </div>

                        {/* Details */}
                        {!deal.customer_email && (
                          <p className="text-[10px] text-gray-300 ml-14 mb-1 italic">No email address</p>
                        )}
                        {deal.moving_from && (
                          <p className="text-[11px] text-gray-500 truncate mb-1 ml-14">{deal.moving_from} → {deal.moving_to}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 ml-14 mt-1.5">
                          {deal.moving_date && (
                            <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded font-medium">
                              {new Date(deal.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {hasBooking && <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-medium">📅 Booked</span>}
                        </div>

                        {/* Action icons — show on hover */}
                        <div className="flex items-center gap-1 mt-2 ml-14 opacity-0 group-hover:opacity-100 transition-opacity">
                          {deal.customer_phone && (
                            <a href={`tel:${deal.customer_phone}`} onClick={e => e.stopPropagation()} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Call">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </a>
                          )}
                          {deal.customer_email && (
                            <button onClick={e => { e.stopPropagation(); onBulkEmail([{ name: deal.customer_name, email: deal.customer_email! }]); }} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title="Email">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); onEditDeal(deal); }} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition" title="Edit">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); if (confirm(`Delete ${deal.customer_name}?`)) onDeleteDeal(deal.id); }} className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {stageDeals.length === 0 && (
                    <div className="text-center py-6 text-gray-300 text-xs">No deals</div>
                  )}
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

function DiaryTab({ events, deals, selectedDate, onSelectDate, onAddEvent, onEditEvent, onDeleteEvent, onToggleComplete, onClickEvent, onRescheduleEvent, customEventTypes }: {
  events: DiaryEvent[]; deals: Deal[]; selectedDate: Date; onSelectDate: (d: Date) => void;
  onAddEvent: (prefillDate?: Date) => void; onEditEvent: (e: DiaryEvent) => void; onDeleteEvent: (id: string) => void; onToggleComplete: (id: string, c: boolean) => void;
  onClickEvent: (e: DiaryEvent) => void;
  onRescheduleEvent: (eventId: string, newDate: Date) => void;
  customEventTypes?: { key: string; label: string; color: string }[];
}) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

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
    return events.filter((e) => {
      const d = new Date(e.start_time);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const selectedDayEvents = events.filter((e) => {
    const d = new Date(e.start_time);
    return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  });

  const handleDayClick = (day: number) => { onSelectDate(new Date(year, month, day)); setViewMode('day'); };
  const goToPrevDay = () => { const prev = new Date(selectedDate); prev.setDate(prev.getDate() - 1); onSelectDate(prev); };
  const goToNextDay = () => { const next = new Date(selectedDate); next.setDate(next.getDate() + 1); onSelectDate(next); };

  // Build color lookup from custom event types
  const customColorMap: Record<string, string> = {};
  if (customEventTypes) {
    customEventTypes.forEach(et => { customColorMap[et.key] = et.color; });
  }
  const fallbackColors: Record<string, { bg: string; border: string; text: string }> = {
    job: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
    survey: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
    callback: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
    delivery: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
    packing: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
    other: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' },
  };
  const getEventColor = (eventType: string) => {
    const hex = customColorMap[eventType];
    if (hex) return { hex, bg: '', border: '', text: '' };
    return { hex: '', ...(fallbackColors[eventType] || fallbackColors.other) };
  };
  // Keep this alias so existing references still work
  const eventTypeColors = fallbackColors;

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

  const isEventVisible = (event: DiaryEvent) => { const start = new Date(event.start_time); const hour = start.getHours(); return hour >= 6 && hour <= 22; };

  const nowHour = today.getHours() + today.getMinutes() / 60;
  const isToday = selectedDate.getDate() === today.getDate() && selectedDate.getMonth() === today.getMonth() && selectedDate.getFullYear() === today.getFullYear();
  const currentTimeTop = (nowHour - 6) * 64;

  const monthDeals = deals.filter((d) => { if (!d.moving_date) return false; const dd = new Date(d.moving_date); return dd.getMonth() === month && dd.getFullYear() === year; });
  const monthlyRevenue = monthDeals.reduce((s, d) => s + (d.estimated_value || 0), 0);

  const weeklyRevenue: Record<number, { revenue: number; deals: number; startDate: Date; endDate: Date }> = {};
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  // Always produce exactly 4 weeks based on actual calendar weeks in the month
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const startDay = (weekNum - 1) * 7 + 1;
    const endDay = weekNum === 4 ? lastOfMonth.getDate() : weekNum * 7;
    const weekStart = new Date(year, month, startDay);
    const weekEnd = new Date(year, month, endDay);
    weeklyRevenue[weekNum] = { revenue: 0, deals: 0, startDate: weekStart, endDate: weekEnd };
    monthDeals.forEach((deal) => {
      const dd = new Date(deal.moving_date!);
      if (dd >= weekStart && dd <= weekEnd) {
        weeklyRevenue[weekNum].revenue += deal.estimated_value || 0;
        weeklyRevenue[weekNum].deals += 1;
      }
    });
  }

  const completedJobsThisMonth = events.filter((e) => { if (!e.completed || e.event_type !== 'job') return false; const d = new Date(e.start_time); return d.getMonth() === month && d.getFullYear() === year; }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-2xl font-bold text-gray-900">Diary</h2><p className="text-sm text-gray-500 mt-1">{events.length} scheduled events</p></div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Month</button>
            <button onClick={() => setViewMode('week')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Week</button>
            <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${viewMode === 'day' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Day</button>
          </div>
          <button onClick={() => { onSelectDate(new Date()); setViewMode('day'); }} className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition">Today</button>
          <button onClick={() => { const d = new Date(selectedDate); d.setHours(9, 0, 0, 0); onAddEvent(d); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Event</button>
        </div>
      </div>

      {viewMode === 'month' && (
        <>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => onSelectDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <h3 className="font-bold text-gray-900 text-lg">{selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
            <button onClick={() => onSelectDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (<div key={d} className="py-2">{d}</div>))}</div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const dayEvents = getEventsForDay(day);
              const isTodayCell = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const isSelected = day === selectedDate.getDate() && month === selectedDate.getMonth();
              const isDragOver = dragOverDay === day && dragEventId !== null;
              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(day)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverDay(day); }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDay(null);
                    const evtId = e.dataTransfer.getData('text/plain');
                    if (evtId) {
                      const targetDate = new Date(year, month, day);
                      onRescheduleEvent(evtId, targetDate);
                    }
                    setDragEventId(null);
                  }}
                  className={`p-1.5 rounded-lg text-sm transition-all min-h-[72px] flex flex-col items-start cursor-pointer ${
                    isDragOver ? 'bg-blue-100 ring-2 ring-blue-400 scale-[1.02]' :
                    isSelected ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
                    isTodayCell ? 'bg-blue-50 text-blue-700' :
                    'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className={`text-xs font-semibold mb-1 ${isTodayCell && !isSelected ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}`}>{day}</span>
                  {dayEvents.slice(0, 2).map((evt, i) => {
                    const colors = eventTypeColors[evt.event_type] || eventTypeColors.other;
                    const evtColors = getEventColor(evt.event_type);
                    return (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', evt.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDragEventId(evt.id);
                        }}
                        onDragEnd={() => { setDragEventId(null); setDragOverDay(null); }}
                        className={`w-full text-left truncate text-[10px] px-1 py-0.5 rounded mb-0.5 cursor-grab active:cursor-grabbing ${
                          dragEventId === evt.id ? 'opacity-40' : ''
                        } ${isSelected ? 'bg-white/20 text-white' : !evtColors.hex ? `${evtColors.bg} ${evtColors.text}` : ''}`}
                        style={!isSelected && evtColors.hex ? { backgroundColor: evtColors.hex + '20', color: evtColors.hex } : undefined}
                      >
                        {new Date(evt.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {evt.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>+{dayEvents.length - 2} more</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Revenue — {selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
            <div className="text-right"><p className="text-2xl font-bold text-green-600">£{monthlyRevenue.toLocaleString()}</p><p className="text-xs text-gray-500">{monthDeals.length} deal{monthDeals.length !== 1 ? 's' : ''} • {completedJobsThisMonth} job{completedJobsThisMonth !== 1 ? 's' : ''} completed</p></div>
          </div>
          <div className="space-y-2">
            {Object.entries(weeklyRevenue).map(([week, data]) => {
              const weekLabel = `${data.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${data.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
              const percentage = monthlyRevenue > 0 ? (data.revenue / monthlyRevenue) * 100 : 0;
              return (
                <div key={week} className="flex items-center gap-3">
                  <div className="w-24 flex-shrink-0"><p className="text-xs font-semibold text-gray-700">Week {week}</p><p className="text-[10px] text-gray-400">{weekLabel}</p></div>
                  <div className="flex-1"><div className="h-6 bg-gray-100 rounded-full overflow-hidden relative"><div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500" style={{ width: `${Math.max(percentage, data.revenue > 0 ? 8 : 0)}%` }} />{data.revenue > 0 && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-700">{data.deals} deal{data.deals !== 1 ? 's' : ''}</span>}</div></div>
                  <div className="w-20 text-right flex-shrink-0"><p className={`text-sm font-bold ${data.revenue > 0 ? 'text-green-600' : 'text-gray-300'}`}>£{data.revenue.toLocaleString()}</p></div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full" /><span className="text-sm font-semibold text-gray-800">Monthly Total</span></div>
            <p className="text-xl font-bold text-green-600">£{monthlyRevenue.toLocaleString()}</p>
          </div>
        </div>
        </>
      )}
{viewMode === 'week' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {/* Week header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); onSelectDate(d); }} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="text-center">
              {(() => {
                const ws = new Date(selectedDate);
                const d = ws.getDay();
                ws.setDate(ws.getDate() - (d === 0 ? 6 : d - 1));
                const we = new Date(ws); we.setDate(we.getDate() + 6);
                return <h3 className="font-bold text-gray-900">{ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {we.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</h3>;
              })()}
            </div>
            <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); onSelectDate(d); }} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {(() => {
            const ws = new Date(selectedDate);
            const dow = ws.getDay();
            ws.setDate(ws.getDate() - (dow === 0 ? 6 : dow - 1));
            const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d; });
            const weekHours = Array.from({ length: 17 }, (_, i) => i + 6);
            const eventTypeColors: Record<string, { bg: string; border: string; text: string }> = {
              job:      { bg: 'bg-blue-100',   border: 'border-blue-400',   text: 'text-blue-800' },
              survey:   { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
              callback: { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800' },
              delivery: { bg: 'bg-green-100',  border: 'border-green-400',  text: 'text-green-800' },
              packing:  { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
              other:    { bg: 'bg-gray-100',   border: 'border-gray-400',   text: 'text-gray-800' },
            };
            const nowHourFrac = today.getHours() + today.getMinutes() / 60;
            const ROW_H = 48;

            return (
              <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
                {/* Day header row */}
                <div className="flex sticky top-0 z-20 bg-white border-b">
                  <div className="w-14 flex-shrink-0" />
                  {weekDays.map((day, i) => {
                    const isTodayCol = day.toDateString() === today.toDateString();
                    return (
                      <div key={i} onClick={() => { onSelectDate(day); setViewMode('day'); }}
                        className={`flex-1 text-center py-2 border-l cursor-pointer hover:bg-gray-50 transition ${isTodayCol ? 'bg-blue-50' : ''}`}>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                        <div className={`text-base font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isTodayCol ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>
                          {day.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="relative flex">
                  {/* Hour labels */}
                  <div className="w-14 flex-shrink-0">
                    {weekHours.map(hour => (
                      <div key={hour} style={{ height: `${ROW_H}px` }} className="flex items-start justify-end pr-2 pt-0.5">
                        <span className="text-[10px] text-gray-400 font-medium">
                          {hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day, i) => {
                    const isTodayCol = day.toDateString() === today.toDateString();
                    const dayEvents = events.filter(e => new Date(e.start_time).toDateString() === day.toDateString());
                    return (
                      <div key={i} className={`flex-1 border-l relative ${isTodayCol ? 'bg-blue-50/20' : ''}`}
                        style={{ height: `${weekHours.length * ROW_H}px` }}>
                        {/* Hour lines */}
                        {weekHours.map(hour => (
                          <div key={hour} style={{ top: `${(hour - 6) * ROW_H}px`, height: `${ROW_H}px` }}
                            className={`absolute w-full border-t border-gray-100 cursor-pointer transition ${dragOverHour === hour && dragEventId ? 'bg-blue-100 ring-1 ring-blue-400' : 'hover:bg-blue-50/30'}`}
                            onClick={() => { const d = new Date(day); d.setHours(hour, 0, 0, 0); onAddEvent(d); }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverHour(hour); }}
                            onDragLeave={() => setDragOverHour(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverHour(null);
                              const evtId = e.dataTransfer.getData('text/plain');
                              if (evtId) {
                                const targetDate = new Date(day);
                                targetDate.setHours(hour, 0, 0, 0);
                                onRescheduleEvent(evtId, targetDate);
                              }
                              setDragEventId(null);
                            }} />
                        ))}

                        {/* Current time line */}
                        {isTodayCol && nowHourFrac >= 6 && nowHourFrac <= 23 && (
                          <div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
                            style={{ top: `${(nowHourFrac - 6) * ROW_H}px` }}>
                            <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                            <div className="flex-1 h-px bg-red-500" />
                          </div>
                        )}

                        {/* Events */}
                        {(() => {
                          // Build overlap columns
                          const evtLayout = dayEvents.map((evt, j) => {
                            const start = new Date(evt.start_time);
                            const end = evt.end_time ? new Date(evt.end_time) : new Date(start.getTime() + 3600000);
                            return { evt, j, startH: start.getHours() + start.getMinutes() / 60, endH: end.getHours() + end.getMinutes() / 60 };
                          });
                          // Assign columns to overlapping events
                          const cols: number[] = new Array(evtLayout.length).fill(0);
                          const totalCols: number[] = new Array(evtLayout.length).fill(1);
                          for (let a = 0; a < evtLayout.length; a++) {
                            const usedCols: number[] = [];
                            for (let b = 0; b < a; b++) {
                              if (evtLayout[b].startH < evtLayout[a].endH && evtLayout[b].endH > evtLayout[a].startH) {
                                usedCols.push(cols[b]);
                              }
                            }
                            let col = 0;
                            while (usedCols.includes(col)) col++;
                            cols[a] = col;
                          }
                          // Calculate total cols per event
                          for (let a = 0; a < evtLayout.length; a++) {
                            let max = cols[a];
                            for (let b = 0; b < evtLayout.length; b++) {
                              if (b !== a && evtLayout[b].startH < evtLayout[a].endH && evtLayout[b].endH > evtLayout[a].startH) {
                                max = Math.max(max, cols[b]);
                              }
                            }
                            totalCols[a] = max + 1;
                          }
                          return evtLayout.map(({ evt, j, startH, endH }, idx) => {
                          const top = Math.max(0, (startH - 6) * ROW_H);
                          const height = Math.max((endH - startH) * ROW_H, 20);
                          const colors = eventTypeColors[evt.event_type] || eventTypeColors.other;
                          const colWidth = 100 / totalCols[idx];
                          const colLeft = cols[idx] * colWidth;
                          return (
                            <div key={j}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData('text/plain', evt.id); e.dataTransfer.effectAllowed = 'move'; setDragEventId(evt.id); }}
                              onDragEnd={() => { setDragEventId(null); setDragOverHour(null); }}
                              onClick={(e) => { e.stopPropagation(); onClickEvent(evt); }}
                              className={`absolute z-10 rounded border-l-2 px-1 py-0.5 cursor-grab active:cursor-grabbing hover:shadow-md transition overflow-hidden ${colors.bg} ${colors.border} ${evt.completed ? 'opacity-50' : ''} ${dragEventId === evt.id ? 'opacity-40' : ''}`}
                              style={{ top: `${top}px`, height: `${height}px`, left: `${colLeft}%`, width: `${colWidth - 1}%` }}>
                              <p className={`text-[10px] font-semibold truncate ${colors.text}`}>
                                {new Date(evt.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {evt.title}
                              </p>
                              {height > 30 && evt.customer_name && <p className={`text-[9px] truncate opacity-75 ${colors.text}`}>{evt.customer_name}</p>}
                            </div>
                          );
                        });
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Weekly revenue summary */}
          {(() => {
            const ws = new Date(selectedDate);
            const dow = ws.getDay();
            ws.setDate(ws.getDate() - (dow === 0 ? 6 : dow - 1));
            const we = new Date(ws); we.setDate(we.getDate() + 6);
            const weekDeals = deals.filter(d => { if (!d.moving_date) return false; const dd = new Date(d.moving_date); return dd >= ws && dd <= we; });
            const weekRevenue = weekDeals.reduce((s, d) => s + (d.estimated_value || 0), 0);
            if (weekRevenue === 0) return null;
            return (
              <div className="px-5 py-3 bg-green-50 border-t flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">{weekDeals.length} deal{weekDeals.length !== 1 ? 's' : ''} this week</span>
                <span className="text-lg font-bold text-green-600">£{weekRevenue.toLocaleString()}</span>
              </div>
            );
          })()}
        </div>
      )}
      {viewMode === 'day' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
            <button onClick={goToPrevDay} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <div className="text-center">
              <h3 className="font-bold text-gray-900 text-lg">{selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
              <div className="flex items-center justify-center gap-3 mt-0.5">
                <p className="text-xs text-gray-500">{selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}</p>
                {(() => { const dayDeals = deals.filter((d) => { if (!d.moving_date) return false; const dd = new Date(d.moving_date); return dd.getDate() === selectedDate.getDate() && dd.getMonth() === selectedDate.getMonth() && dd.getFullYear() === selectedDate.getFullYear(); }); const dayRev = dayDeals.reduce((s, d) => s + (d.estimated_value || 0), 0); return dayRev > 0 ? <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">£{dayRev.toLocaleString()} revenue</span> : null; })()}
              </div>
            </div>
            <button onClick={goToNextDay} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
          </div>

          {selectedDayEvents.filter(e => !isEventVisible(e)).length > 0 && (
            <div className="px-5 py-2 border-b bg-amber-50">
              <p className="text-xs font-semibold text-amber-700 mb-1">Other times</p>
             {selectedDayEvents.filter(e => !isEventVisible(e)).map((event) => {
                const otColors = getEventColor(event.event_type);
                return <div key={event.id} onClick={() => onClickEvent(event)} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-pointer mr-2 mb-1 ${!otColors.hex ? `${otColors.bg} ${otColors.text}` : ''}`} style={otColors.hex ? { backgroundColor: otColors.hex + '20', color: otColors.hex } : undefined}>{new Date(event.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} {event.title}</div>;
              })}
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
            <div className="relative" style={{ height: `${hours.length * 64}px` }}>
              {hours.map((hour) => (
                <div key={hour} className="absolute w-full flex" style={{ top: `${(hour - 6) * 64}px`, height: '64px' }}>
                  <div className="w-16 sm:w-20 flex-shrink-0 pr-2 text-right"><span className="text-xs text-gray-400 font-medium -mt-2 block">{hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}</span></div>
                  <div
                    className={`flex-1 border-t border-gray-100 relative group cursor-pointer transition ${
                      dragOverHour === hour && dragEventId ? 'bg-blue-100 ring-1 ring-blue-400' : 'hover:bg-blue-50/30'
                    }`}
                    onClick={() => { const d = new Date(selectedDate); d.setHours(hour, 0, 0, 0); onAddEvent(d); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverHour(hour); }}
                    onDragLeave={() => setDragOverHour(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverHour(null);
                      const evtId = e.dataTransfer.getData('text/plain');
                      if (evtId) {
                        const targetDate = new Date(selectedDate);
                        targetDate.setHours(hour, 0, 0, 0);
                        onRescheduleEvent(evtId, targetDate);
                      }
                      setDragEventId(null);
                    }}
                  >
                    <div className="absolute w-full border-t border-gray-50" style={{ top: '32px' }} />
                    <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 transition"><span className="text-[10px] text-blue-400 font-medium">+ Add</span></div>
                  </div>
                </div>
              ))}

              {isToday && nowHour >= 6 && nowHour <= 23 && (
                <div className="absolute left-16 sm:left-20 right-0 z-20 flex items-center" style={{ top: `${currentTimeTop}px` }}><div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5" /><div className="flex-1 h-0.5 bg-red-500" /></div>
              )}

              {selectedDayEvents.filter(isEventVisible).map((event) => {
                const style = getEventStyle(event);
                const dayEvtColors = getEventColor(event.event_type);
                const startTime = new Date(event.start_time);
                const endTime = event.end_time ? new Date(event.end_time) : null;
                return (
                  <div
                    key={event.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', event.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragEventId(event.id);
                    }}
                    onDragEnd={() => { setDragEventId(null); setDragOverHour(null); }}
                    className={`absolute left-16 sm:left-20 right-2 z-10 rounded-lg border-l-4 px-3 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all overflow-hidden ${
                      dragEventId === event.id ? 'opacity-40' : ''
                    } ${!dayEvtColors.hex ? `${dayEvtColors.bg} ${dayEvtColors.border}` : ''} ${event.completed ? 'opacity-50' : ''}`}
                    style={{ top: style.top, height: style.height, minHeight: '28px', ...(dayEvtColors.hex ? { backgroundColor: dayEvtColors.hex + '20', borderColor: dayEvtColors.hex } : {}) }}
                    onClick={() => onClickEvent(event)}
                  >                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${!dayEvtColors.hex ? dayEvtColors.text : ''}`} style={dayEvtColors.hex ? { color: dayEvtColors.hex } : undefined}>{event.title}</p>
                        <p className="text-[11px] text-gray-500">{startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{endTime && ` – ${endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</p>
                        {event.customer_name && <p className="text-[11px] text-gray-500 truncate">{event.customer_name}</p>}
                        {event.location && <p className="text-[10px] text-gray-400 truncate">📍 {event.location}</p>}
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0 mt-0.5">
                        <button onClick={(e) => { e.stopPropagation(); onToggleComplete(event.id, !event.completed); }} className={`w-5 h-5 rounded flex items-center justify-center transition ${event.completed ? 'bg-green-500 text-white' : 'border border-gray-300 hover:border-green-400'}`}>{event.completed && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }} className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
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

function CustomersTab({ customers, search, onSearchChange, onAddCustomer, onEditCustomer, onDeleteCustomer, onSendQuoteLink, crmQuotes, onClickQuote, emailConnected, onComposeEmail, onClickCustomer, stages, company }: {
  customers: Customer[]; search: string; onSearchChange: (s: string) => void;
  onAddCustomer: () => void; onEditCustomer: (c: Customer) => void; onDeleteCustomer: (id: string) => void;
  onSendQuoteLink: (c: Customer) => void;
  crmQuotes: CrmQuote[];
  onClickQuote: (q: CrmQuote) => void;
  emailConnected: boolean;
  onComposeEmail: (c: Customer) => void;
  onClickCustomer: (c: Customer) => void;
  stages: PipelineStage[];
  company: Company;
}) {

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [pipelineCustomer, setPipelineCustomer] = useState<Customer | null>(null);
  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));
  const totalRevenue = customers.reduce((s, c) => s + (c.total_revenue || 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} customers • <span className="text-green-600 font-semibold">£{totalRevenue.toLocaleString()} revenue</span></p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search contacts..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
          </div>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`p-2 transition ${viewMode === 'table' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            </button>
            <button onClick={() => setViewMode('cards')} className={`p-2 transition ${viewMode === 'cards' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </button>
          </div>
          <button onClick={onAddCustomer} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Contact
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center"><p className="text-gray-500">{search ? 'No customers match your search' : 'Add your first customer to get started'}</p></div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Contact</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Source</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Revenue</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((customer) => {
                const customerQuotes = crmQuotes.filter((q) => q.customer_name.toLowerCase() === customer.name.toLowerCase());
                return (
                  <tr key={customer.id} className="hover:bg-gray-50/80 transition group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => onClickCustomer(customer)} className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition text-left">{customer.name}</button>
                          <p className="text-xs text-gray-400 truncate">{customer.email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">{customer.phone || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {customer.source ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{customer.source}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600 text-sm hidden lg:table-cell">£{customer.total_revenue?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-0.5 justify-end">
                        {customer.phone && (
                          <a href={`tel:${customer.phone}`} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Call">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          </a>
                        )}
                        {customer.email && (
                          <button onClick={() => onComposeEmail(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title={emailConnected ? 'Send email via Gmail' : 'Email'}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </button>
                        )}
                        <button onClick={() => setPipelineCustomer(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition" title="Add to pipeline">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </button>
                        <button onClick={() => onSendQuoteLink(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition" title="Send quote link">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        </button>
                        {customerQuotes.length > 0 && (
                          <button onClick={() => onClickQuote(customerQuotes[0])} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition relative" title={`${customerQuotes.length} quote(s)`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold">{customerQuotes.length}</span>
                          </button>
                        )}
                        <button onClick={() => onEditCustomer(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => { if (confirm(`Delete ${customer.name}?`)) onDeleteCustomer(customer.id); }} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((customer) => {
            const customerQuotes = crmQuotes.filter((q) => q.customer_name.toLowerCase() === customer.name.toLowerCase());
            return (
              <div key={customer.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-lg hover:border-gray-200 transition-all group">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onClickCustomer(customer)} className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition text-left">{customer.name}</button>
                    <p className="text-xs text-gray-400 truncate">{customer.email || 'No email'}</p>
                    <p className="text-xs text-gray-400">{customer.phone || 'No phone'}</p>
                  </div>
                  {customer.total_revenue ? <span className="text-sm font-bold text-green-600">£{customer.total_revenue.toLocaleString()}</span> : null}
                </div>
                {customer.moving_from && (
                  <p className="text-xs text-gray-500 mb-2 truncate">{customer.moving_from} → {customer.moving_to || '—'}</p>
                )}
                {customer.source && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-medium">{customer.source}</span>}
                
                {/* Action row */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Call">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </a>
                  )}
                  {customer.email && (
                    <button onClick={() => onComposeEmail(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title={emailConnected ? 'Send email via Gmail' : 'Email'}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </button>
                  )}
                  <button onClick={() => setPipelineCustomer(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition" title="Add to pipeline">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </button>
                  <button onClick={() => onSendQuoteLink(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition" title="Quote link">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  </button>
                  <div className="flex-1" />
                  <button onClick={() => onEditCustomer(customer)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition" title="Edit">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => { if (confirm(`Delete ${customer.name}?`)) onDeleteCustomer(customer.id); }} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
{/* Add to Pipeline Modal */}
      {pipelineCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPipelineCustomer(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Add to Pipeline</h3>
            <p className="text-sm text-gray-500 mb-4">{pipelineCustomer.name}</p>
            <div className="space-y-2">
              {stages.map(stage => (
                <button key={stage.id}
                  onClick={async () => {
                    const { supabase } = await import('@/lib/supabaseClient');
                    await supabase.from('crm_deals').insert({
                      company_id: company.id,
                      customer_name: pipelineCustomer.name,
                      customer_email: pipelineCustomer.email,
                      customer_phone: pipelineCustomer.phone,
                      customer_id: pipelineCustomer.id,
                      stage_id: stage.id,
                    });
                    setPipelineCustomer(null);
                    alert(`${pipelineCustomer.name} added to ${stage.name}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-left">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="font-medium text-gray-800 text-sm">{stage.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPipelineCustomer(null)} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// REPORTS TAB
// ============================================

function ReportsTab({ leads, deals, customers, events, crmQuotes, company, costs, onAddCost, onUpdateCost, onDeleteCost }: {
  leads: Lead[]; deals: Deal[]; customers: Customer[]; events: DiaryEvent[]; crmQuotes: CrmQuote[]; company: Company;
  costs: CrmCost[];
  onAddCost: (cost: Partial<CrmCost>) => Promise<any>;
  onUpdateCost: (costId: string, fields: Partial<CrmCost>) => void;
  onDeleteCost: (costId: string) => void;
}) {
  const [subTab, setSubTab] = useState<'overview' | 'costs' | 'pnl'>('overview');
  const [period, setPeriod] = useState<'month' | 'lastmonth' | 'quarter' | 'all'>('month');
  const [showAddCost, setShowAddCost] = useState(false);
  const [newCost, setNewCost] = useState({ category: 'fuel', description: '', amount: '', deal_id: '', cost_date: new Date().toISOString().split('T')[0] });
  const [savingCost, setSavingCost] = useState(false);
  const [costFilter, setCostFilter] = useState('all');

  const CATEGORIES = [
    { value: 'fuel', label: 'Fuel', icon: '⛽', color: 'bg-red-100 text-red-700' },
    { value: 'labour', label: 'Labour', icon: '👷', color: 'bg-blue-100 text-blue-700' },
    { value: 'materials', label: 'Materials', icon: '📦', color: 'bg-amber-100 text-amber-700' },
    { value: 'packing', label: 'Packing Supplies', icon: '🎁', color: 'bg-purple-100 text-purple-700' },
    { value: 'tolls', label: 'Tolls / Parking', icon: '🅿️', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'storage', label: 'Storage', icon: '🏪', color: 'bg-orange-100 text-orange-700' },
    { value: 'subcontractor', label: 'Subcontractor', icon: '🤝', color: 'bg-indigo-100 text-indigo-700' },
    { value: 'vehicle', label: 'Vehicle / Maintenance', icon: '🔧', color: 'bg-gray-100 text-gray-700' },
    { value: 'insurance', label: 'Insurance', icon: '🛡️', color: 'bg-teal-100 text-teal-700' },
    { value: 'other', label: 'Other', icon: '📋', color: 'bg-gray-100 text-gray-600' },
  ];

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  // Period filtering
  const now = new Date();
  const filterByPeriod = (dateStr: string) => {
    const d = new Date(dateStr);
    if (period === 'all') return true;
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'lastmonth') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    }
    if (period === 'quarter') {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return d >= qStart;
    }
    return true;
  };

  const periodCosts = costs.filter(c => filterByPeriod(c.cost_date));
  const periodDeals = deals.filter(d => d.moving_date ? filterByPeriod(d.moving_date) : false);
  const completedDeals = periodDeals.filter(d => {
    const linkedEvents = events.filter(e => e.deal_id === d.id && e.completed && e.event_type === 'job');
    return linkedEvents.length > 0;
  });

  // Only show costs for completed jobs — filter costs to only those linked to completed deals
  const completedDealIds = new Set(completedDeals.map(d => d.id));
  const periodCostsCompleted = periodCosts.filter(c => !c.deal_id || completedDealIds.has(c.deal_id));

  const totalRevenue = completedDeals.reduce((s, d) => {
    // Use linked quote price if available, fall back to deal value
    const linkedQuote = crmQuotes.find(q => q.deal_id === d.id && q.estimated_price);
    return s + (linkedQuote?.estimated_price || d.estimated_value || 0);
  }, 0);
  const totalCosts = periodCostsCompleted.reduce((s, c) => s + Number(c.amount), 0);
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : '0';

  // Cost breakdown by category
  const categoryBreakdown = CATEGORIES.map(cat => {
    const catCosts = periodCostsCompleted.filter(c => c.category === cat.value);
    const total = catCosts.reduce((s, c) => s + Number(c.amount), 0);
    return { ...cat, total, count: catCosts.length };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const maxCategoryTotal = Math.max(...categoryBreakdown.map(c => c.total), 1);

  // Per-job P&L
 const jobPnl = completedDeals.map(deal => {
    const dealCosts = periodCostsCompleted.filter(c => c.deal_id === deal.id);
    const dealCostTotal = dealCosts.reduce((s, c) => s + Number(c.amount), 0);
    const linkedQuote = crmQuotes.find(q => q.deal_id === deal.id && q.estimated_price);
    const dealRevenue = linkedQuote?.estimated_price || deal.estimated_value || 0;
    const dealProfit = dealRevenue - dealCostTotal;
    const dealMargin = dealRevenue > 0 ? ((dealProfit / dealRevenue) * 100).toFixed(1) : '0';
    return { deal, costs: dealCosts, revenue: dealRevenue, totalCost: dealCostTotal, profit: dealProfit, margin: dealMargin };
  }).sort((a, b) => b.revenue - a.revenue);

  // Filtered cost log
  const filteredCosts = costFilter === 'all' ? periodCostsCompleted : periodCostsCompleted.filter(c => c.category === costFilter);

  // Existing overview stats
  const totalDealValue = deals.reduce((s, d) => s + (d.estimated_value || 0), 0);
  const totalQuoteValue = crmQuotes.reduce((s, q) => s + (q.estimated_price || 0), 0);
  const acceptedQuoteValue = crmQuotes.filter((q) => q.status === 'accepted').reduce((s, q) => s + (q.estimated_price || 0), 0);
  const completedEvents = events.filter((e) => e.completed).length;
  const wonLeads = leads.filter((l) => l.status === 'won').length;
  const conversionRate = leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) : '0';
  const quoteConversion = crmQuotes.length > 0 ? ((crmQuotes.filter(q => q.status === 'accepted').length / crmQuotes.length) * 100).toFixed(1) : '0';

  const handleAddCost = async () => {
    if (!newCost.amount || parseFloat(newCost.amount) <= 0) { alert('Please enter an amount'); return; }
    setSavingCost(true);
    await onAddCost({
      category: newCost.category,
      description: newCost.description || null,
      amount: parseFloat(newCost.amount),
      deal_id: newCost.deal_id || null,
      cost_date: newCost.cost_date,
    } as any);
    setNewCost({ category: 'fuel', description: '', amount: '', deal_id: '', cost_date: new Date().toISOString().split('T')[0] });
    setShowAddCost(false);
    setSavingCost(false);
  };

  const overviewStats = [
    { label: 'Total Leads', value: leads.length, color: 'text-blue-700' }, { label: 'Won Leads', value: wonLeads, color: 'text-green-700' }, { label: 'Lead Conversion', value: `${conversionRate}%`, color: 'text-purple-700' }, { label: 'Pipeline Value', value: `£${totalDealValue.toLocaleString()}`, color: 'text-yellow-700' },
    { label: 'Quotes Sent', value: crmQuotes.length, color: 'text-indigo-700' }, { label: 'Quote Conversion', value: `${quoteConversion}%`, color: 'text-teal-700' }, { label: 'Total Quote Value', value: `£${totalQuoteValue.toLocaleString()}`, color: 'text-orange-700' }, { label: 'Accepted Value', value: `£${acceptedQuoteValue.toLocaleString()}`, color: 'text-emerald-700' },
    { label: 'Total Customers', value: customers.length, color: 'text-indigo-700' }, { label: 'Pipeline Deals', value: deals.length, color: 'text-orange-700' }, { label: 'Jobs Completed', value: completedEvents, color: 'text-teal-700' }, { label: 'Account Balance', value: `£${company.balance?.toFixed(2) || '0.00'}`, color: 'text-emerald-700' },
  ];

  const periodLabels: Record<string, string> = { month: 'This Month', lastmonth: 'Last Month', quarter: 'This Quarter', all: 'All Time' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-1">Business performance & financial tracking</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'costs', label: 'Cost Tracker' },
          { key: 'pnl', label: 'Profit & Loss' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key as any)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              subTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════ OVERVIEW SUB-TAB ═══════ */}
      {subTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {overviewStats.map((stat, i) => (<div key={i} className="bg-white rounded-xl border p-5"><p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p><p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p></div>))}
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
        </>
      )}

      {/* ═══════ COST TRACKER SUB-TAB ═══════ */}
      {subTab === 'costs' && (
        <>
          {/* Period filter + Add button */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex gap-2">
              {(['month', 'lastmonth', 'quarter', 'all'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${period === p ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddCost(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">+ Add Cost</button>
          </div>

          {/* P&L Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Revenue</p>
              <p className="text-2xl font-bold text-green-600">£{totalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">{completedDeals.length} completed job{completedDeals.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Total Costs</p>
              <p className="text-2xl font-bold text-red-600">£{totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-gray-400 mt-1">{periodCosts.length} expense{periodCosts.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Profit</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-xs font-medium text-gray-500 mb-1">Margin</p>
              <p className={`text-2xl font-bold ${parseFloat(margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin}%</p>
            </div>
          </div>

          {/* Cost Breakdown by Category */}
          {categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border p-5 mb-6">
              <h3 className="font-bold text-gray-900 mb-4">Cost Breakdown</h3>
              <div className="space-y-3">
                {categoryBreakdown.map(cat => (
                  <div key={cat.value} className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center flex-shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                        <span className="text-sm font-bold text-gray-900">£{cat.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(cat.total / maxCategoryTotal) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">{totalCosts > 0 ? ((cat.total / totalCosts) * 100).toFixed(0) : 0}%</span>
                  </div>
                ))}
              </div>
              {categoryBreakdown.length > 0 && (
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Highest cost:</span>
                  <span className="text-sm font-bold text-red-600">{categoryBreakdown[0].icon} {categoryBreakdown[0].label} — £{categoryBreakdown[0].total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          )}

          {/* Add Cost Form */}
          {showAddCost && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-800 text-sm">Add New Cost</h3>
                <button onClick={() => setShowAddCost(false)} className="text-blue-400 hover:text-blue-600 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Category</label>
                  <select value={newCost.category} onChange={e => setNewCost({ ...newCost, category: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount (£)</label>
                  <input type="number" step="0.01" value={newCost.amount} onChange={e => setNewCost({ ...newCost, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date</label>
                  <input type="date" value={newCost.cost_date} onChange={e => setNewCost({ ...newCost, cost_date: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Link to Job (optional)</label>
                  <select value={newCost.deal_id} onChange={e => setNewCost({ ...newCost, deal_id: e.target.value })} className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="">No linked job</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.customer_name}{d.estimated_value ? ` — £${d.estimated_value.toLocaleString()}` : ''}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                <input value={newCost.description} onChange={e => setNewCost({ ...newCost, description: e.target.value })} placeholder="e.g. Diesel fill-up for Bristol job" className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddCost} disabled={savingCost || !newCost.amount} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-40">{savingCost ? 'Adding...' : 'Add Cost'}</button>
                <button onClick={() => setShowAddCost(false)} className="px-5 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
              </div>
            </div>
          )}

          {/* Cost Log */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Cost Log</h3>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setCostFilter('all')} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition ${costFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
                {CATEGORIES.filter(c => periodCosts.some(pc => pc.category === c.value)).map(c => (
                  <button key={c.value} onClick={() => setCostFilter(c.value)} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition ${costFilter === c.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c.icon} {c.label}</button>
                ))}
              </div>
            </div>
            {filteredCosts.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-gray-400 text-sm">{costs.length === 0 ? 'No costs logged yet' : 'No costs match your filters'}</p>
                {costs.length === 0 && <p className="text-xs text-gray-300 mt-1">Click "+ Add Cost" to start tracking expenses</p>}
              </div>
            ) : (
              <div className="divide-y">
                {filteredCosts.map(cost => {
                  const cat = getCategoryInfo(cost.category);
                  const linkedDeal = cost.deal_id ? deals.find(d => d.id === cost.deal_id) : null;
                  return (
                    <div key={cost.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition group">
                      <span className="text-lg flex-shrink-0">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
                          {linkedDeal && <span className="text-[10px] text-gray-400">· {linkedDeal.customer_name}</span>}
                        </div>
                        {cost.description && <p className="text-sm text-gray-600 truncate mt-0.5">{cost.description}</p>}
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(cost.cost_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className="text-sm font-bold text-red-600 flex-shrink-0">-£{Number(cost.amount).toFixed(2)}</span>
                      <button onClick={() => { if (confirm('Delete this cost?')) onDeleteCost(cost.id); }} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════ PROFIT & LOSS SUB-TAB ═══════ */}
      {subTab === 'pnl' && (
        <>
          {/* Period filter */}
          <div className="flex gap-2 mb-5">
            {(['month', 'lastmonth', 'quarter', 'all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${period === p ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* P&L Summary */}
          <div className="bg-white rounded-xl border p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-5">Profit & Loss — {periodLabels[period]}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Revenue ({completedDeals.length} completed jobs)</span>
                <span className="text-lg font-bold text-green-600">£{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t" />
              {categoryBreakdown.map(cat => (
                <div key={cat.value} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-500">{cat.icon} {cat.label} ({cat.count})</span>
                  <span className="text-sm font-semibold text-red-600">-£{cat.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {categoryBreakdown.length > 0 && (
                <>
                  <div className="flex items-center justify-between py-2 border-t">
                    <span className="text-sm font-semibold text-gray-700">Total Costs</span>
                    <span className="text-lg font-bold text-red-600">-£{totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t-2 border-gray-900">
                    <span className="text-base font-bold text-gray-900">Net Profit</span>
                    <span className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-500">Profit Margin</span>
                    <span className={`text-sm font-bold ${parseFloat(margin) >= 20 ? 'text-green-600' : parseFloat(margin) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{margin}%</span>
                  </div>
                </>
              )}
              {categoryBreakdown.length === 0 && (
                <div className="py-4 text-center text-gray-400 text-sm">No costs logged for this period. Add costs in the Cost Tracker tab.</div>
              )}
            </div>
          </div>

          {/* Per-Job P&L Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-bold text-gray-900">Per-Job Profitability</h3>
              <p className="text-xs text-gray-500 mt-0.5">Completed jobs with linked costs</p>
            </div>
            {jobPnl.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-gray-400 text-sm">No completed jobs for this period</p>
                <p className="text-xs text-gray-300 mt-1">Complete jobs in the diary and link costs to see per-job profitability</p>
              </div>
            ) : (
              <div className="divide-y">
                {jobPnl.map(({ deal, revenue, totalCost, profit: jobProfit, margin: jobMargin }) => (
                  <div key={deal.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                      {deal.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{deal.customer_name}</p>
                      {deal.moving_date && <p className="text-[10px] text-gray-400">{new Date(deal.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="text-sm font-semibold text-green-600">£{revenue.toLocaleString()}</p>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-xs text-gray-500">Costs</p>
                      <p className="text-sm font-semibold text-red-600">{totalCost > 0 ? `-£${totalCost.toFixed(2)}` : '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-xs text-gray-500">Profit</p>
                      <p className={`text-sm font-bold ${jobProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{jobProfit.toFixed(2)}</p>
                    </div>
                    <div className="flex-shrink-0 w-14 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        parseFloat(jobMargin) >= 20 ? 'bg-green-100 text-green-700' : parseFloat(jobMargin) >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>{jobMargin}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


// ============================================
// SETTINGS TAB
// ============================================

function SettingsTab({ company, crmActive, onSubscribe, emailConnected, emailAddress, emailLoading, onDisconnectEmail, pdfBranding, onSavePdfBranding, customEventTypes, onSaveEventTypes, customCustomerFields, onSaveCustomerFields, customSources, onSaveSources }: { company: Company; crmActive: boolean; onSubscribe: () => void; emailConnected: boolean; emailAddress: string | null; emailLoading: boolean; onDisconnectEmail: () => void; pdfBranding?: any; onSavePdfBranding?: (branding: any) => Promise<any>; customEventTypes?: { key: string; label: string; color: string }[]; onSaveEventTypes?: (types: any[]) => Promise<any>; customCustomerFields?: { key: string; label: string; type: string }[]; onSaveCustomerFields?: (fields: any[]) => Promise<any>; customSources?: string[]; onSaveSources?: (sources: string[]) => Promise<any>; }) {
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

      {/* EMAIL CONNECTION */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Email Integration</h3>
          {emailConnected && <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Connected</span>}
        </div>
        {emailLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Checking email connection...</div>
        ) : emailConnected ? (
          <div>
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-800 text-sm">Gmail Connected</p>
                <p className="text-green-600 text-xs">{emailAddress}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <p className="flex items-center gap-2">✅ Confirmation emails auto-sent when booking appointments</p>
              <p className="flex items-center gap-2">✅ Emails sent from your Gmail address</p>
              <p className="flex items-center gap-2">✅ Professional branded email template</p>
            </div>
            <button onClick={onDisconnectEmail} className="text-sm text-red-500 hover:text-red-700 font-medium px-4 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition">Disconnect Gmail</button>
          </div>
        ) : (
          <div>
            <p className="text-gray-500 text-sm mb-4">Connect your Gmail to automatically send confirmation emails to customers when you book appointments. Emails will be sent from your own email address.</p>
            <div className="space-y-2 text-sm text-gray-500 mb-5">
              <p className="flex items-center gap-2">📧 Send from your real email address</p>
              <p className="flex items-center gap-2">📅 Auto-send on appointment booking</p>
              <p className="flex items-center gap-2">🎨 Professional branded email template</p>
              <p className="flex items-center gap-2">🔒 Secure OAuth — we never see your password</p>
            </div>
            <a href={`/api/auth/gmail/connect?company_id=${company.id}`} className="inline-flex items-center gap-3 px-5 py-3 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <span className="font-semibold text-gray-700">Connect Gmail</span>
            </a>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Lead Balance</h3>
        <p className="text-3xl font-bold text-blue-600">£{company.balance?.toFixed(2) || '0.00'}</p>
        <p className="text-sm text-gray-500 mt-1">Used for purchasing leads at £10.00 each</p>
      </div>
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-bold text-gray-900 mb-4">CRM Subscription</h3>
        {crmActive ? (
          <div className="flex items-center gap-3"><div className="w-3 h-3 bg-green-500 rounded-full" /><div><p className="font-semibold text-green-700">CRM Pro — Active</p><p className="text-sm text-gray-500">£129.99/month • Quotes, Pipeline, Diary, Customers & Reports</p></div></div>
        ) : (
          <div><p className="text-gray-500 mb-4">Unlock the full CRM suite to manage your removal business.</p><button onClick={onSubscribe} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all">Start CRM Pro — £129.99/month</button></div>
        )}
      </div>

      {/* PDF BRANDING */}
      {onSavePdfBranding && <PdfBrandingSection branding={pdfBranding || {}} onSave={onSavePdfBranding} companyName={company.name} companyEmail={company.email} companyPhone={company.phone} />}

      {/* EVENT TYPES */}
      {onSaveEventTypes && (
        <EventTypesSettings eventTypes={customEventTypes || []} onSave={onSaveEventTypes} />
      )}

      {/* CUSTOM CUSTOMER FIELDS */}
      {onSaveCustomerFields && (
        <CustomerFieldsSettings fields={customCustomerFields || []} onSave={onSaveCustomerFields} />
      )}

      {onSaveSources && (
        <SourcesSettings sources={customSources || []} onSave={onSaveSources} />
      )}
    </div>
  );
}

function PdfBrandingSection({ branding, onSave, companyName, companyEmail, companyPhone }: { branding: any; onSave: (b: any) => Promise<any>; companyName: string; companyEmail?: string; companyPhone?: string; }) {
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color || '#0a0f1c');
  const [secondaryColor, setSecondaryColor] = useState(branding.secondary_color || '#2563eb');
  const [companyNameOverride, setCompanyNameOverride] = useState(branding.company_name_override || '');
  const [footerText, setFooterText] = useState(branding.footer_text || '');
  const [termsText, setTermsText] = useState(branding.terms_text || '');
  const [showPhone, setShowPhone] = useState(branding.show_phone !== false);
  const [showEmail, setShowEmail] = useState(branding.show_email !== false);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url || '');
  const [depositAmount, setDepositAmount] = useState(branding.deposit_amount || '');
  const [paymentTerms, setPaymentTerms] = useState(branding.payment_terms || '');
  const [bankDetails, setBankDetails] = useState(branding.bank_details || '');
  const [watermarkDraft, setWatermarkDraft] = useState(branding.watermark_draft !== false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const config: any = {};
    if (primaryColor !== '#0a0f1c') config.primary_color = primaryColor;
    if (secondaryColor !== '#2563eb') config.secondary_color = secondaryColor;
    if (companyNameOverride.trim()) config.company_name_override = companyNameOverride.trim();
    if (footerText.trim()) config.footer_text = footerText.trim();
    if (termsText.trim()) config.terms_text = termsText.trim();
    if (!showPhone) config.show_phone = false;
    if (!showEmail) config.show_email = false;
    if (!showEmail) config.show_email = false;
    if (logoUrl) config.logo_url = logoUrl;
    if (depositAmount) config.deposit_amount = depositAmount;
    if (paymentTerms.trim()) config.payment_terms = paymentTerms.trim();
    if (bankDetails.trim()) config.bank_details = bankDetails.trim();
    config.watermark_draft = watermarkDraft;
    await onSave(config);
    if (logoUrl) config.logo_url = logoUrl;
    if (depositAmount) config.deposit_amount = depositAmount;
    if (paymentTerms.trim()) config.payment_terms = paymentTerms.trim();
    if (bankDetails.trim()) config.bank_details = bankDetails.trim();
    config.watermark_draft = watermarkDraft;
    await onSave(config);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const filePath = `pdf-logos/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('crm-files').upload(filePath, file);
      if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(false); return; }
      const { data: pubData } = supabase.storage.from('crm-files').getPublicUrl(filePath);
      if (pubData?.publicUrl) setLogoUrl(pubData.publicUrl);
    } catch (err) {
      console.error('Logo upload error:', err);
      alert('Failed to upload logo');
    }
    setUploading(false);
    e.target.value = '';
  };

  const handlePreview = async () => {
    const { downloadQuotePdf } = await import('@/lib/generateQuotePdf');
    await downloadQuotePdf({
      companyName: companyName,
      companyEmail: companyEmail,
      companyPhone: companyPhone,
      quoteDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      quoteRef: 'PREVIEW',
      status: 'draft',
      customerName: 'John Smith',
      customerEmail: 'john@example.com',
      customerPhone: '07700 900000',
      movingFrom: '42 Oxford Street, London W1D 1AN',
      movingTo: '15 High Street, Bristol BS1 2AW',
      movingDate: new Date().toISOString(),
      items: [
        { name: 'Sofa - 3 Seater', quantity: 1, estimated_volume_ft3: 45 },
        { name: 'Double Bed + Mattress', quantity: 2, estimated_volume_ft3: 55 },
        { name: 'Wardrobe - Double', quantity: 1, estimated_volume_ft3: 65 },
        { name: 'Dining Table - 4 Seat', quantity: 1, estimated_volume_ft3: 20 },
        { name: 'Medium Box', quantity: 15, estimated_volume_ft3: 3 },
      ],
      totalVolume: 12,
      vanCount: 1,
      movers: 2,
      estimatedPrice: 850,
      notes: 'Ground floor access at both addresses. Customer has their own packing materials.',
      branding: {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        company_name_override: companyNameOverride || undefined,
        footer_text: footerText || undefined,
        terms_text: termsText || undefined,
        show_phone: showPhone,
        show_email: showEmail,
        logo_url: logoUrl || undefined,
      },
    }, 'quote-preview.pdf');
  };

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">PDF Quote Branding</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customise how your quote PDFs look</p>
        </div>
        {saved && <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
      </div>

      <div className="space-y-5">
        {/* Logo */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Company Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative">
                <img src={logoUrl} alt="Logo" className="h-12 max-w-[120px] object-contain rounded-lg border bg-gray-50 p-1" />
                <button onClick={() => setLogoUrl('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition">×</button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <div className="px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
                  {uploading ? 'Uploading...' : '+ Upload Logo'}
                </div>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            )}
            <p className="text-xs text-gray-400">PNG or JPG, appears in PDF header</p>
          </div>
        </div>

        {/* Colours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Primary Colour</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
              <div>
                <p className="text-sm font-medium text-gray-700">{primaryColor}</p>
                <p className="text-xs text-gray-400">Header, headings, table</p>
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Accent Colour</label>
            <div className="flex items-center gap-3">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" />
              <div>
                <p className="text-sm font-medium text-gray-700">{secondaryColor}</p>
                <p className="text-xs text-gray-400">Labels, total price box</p>
              </div>
            </div>
          </div>
        </div>

        {/* Company name override */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Trading Name (optional)</label>
          <input value={companyNameOverride} onChange={(e) => setCompanyNameOverride(e.target.value)} placeholder={companyName} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <p className="text-xs text-gray-400 mt-1">Leave blank to use your registered company name</p>
        </div>

        {/* Show toggles */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-sm text-gray-700">Show email in header</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-sm text-gray-700">Show phone in header</span>
          </label>
        </div>

        {/* Footer text */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Footer Disclaimer</label>
          <textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="This quote is subject to a final survey of items. Prices may vary based on actual volume and access requirements." rows={2} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>

        {/* Terms */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Terms & Conditions (optional)</label>
          <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} placeholder="e.g. Payment due within 7 days of move completion. Cancellations require 48 hours notice." rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
        </div>
  {/* Deposit + Payment Terms */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Deposit Amount</label>
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. £150 or 25%" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Shows on PDF below total</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Payment Terms</label>
            <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 50% deposit on booking" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Shown next to total price</p>
          </div>
        </div>

        {/* Bank Details */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Bank Details (optional)</label>
          <textarea value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder={"Bank: Lloyds\nAccount Name: Your Company\nSort Code: 12-34-56\nAccount No: 12345678"} rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          <p className="text-xs text-gray-400 mt-1">Printed at the bottom of the PDF</p>
        </div>

        {/* Watermark */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={watermarkDraft} onChange={(e) => setWatermarkDraft(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
          <span className="text-sm text-gray-700">Show "DRAFT" watermark on draft/pending quotes</span>
        </label>
        {/* Deposit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Deposit Amount (£ or %)</label>
            <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 150 or 25%" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Shows on PDF below total</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Payment Terms</label>
            <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 50% deposit on booking" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Shown next to total price</p>
          </div>
        </div>

        {/* Bank details */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Bank Details (optional)</label>
          <textarea value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} placeholder="e.g. Bank: Lloyds&#10;Account Name: MOVCO Ltd&#10;Sort Code: 12-34-56&#10;Account No: 12345678" rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          <p className="text-xs text-gray-400 mt-1">Printed at the bottom of the PDF</p>
        </div>

        {/* Watermark */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={watermarkDraft} onChange={(e) => setWatermarkDraft(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
            <span className="text-sm text-gray-700">Show "DRAFT" watermark on draft/pending quotes</span>
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-6">Large diagonal watermark shown when quote status is draft or pending</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6 pt-5 border-t">
        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-40">
          {saving ? 'Saving...' : 'Save Branding'}
        </button>
        <button onClick={handlePreview} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-200 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Preview PDF
        </button>
      </div>
    </div>
  );
}
// ============================================
// EVENT TYPES SETTINGS
// ============================================

const EVENT_TYPE_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#f97316', '#6b7280',
  '#ef4444', '#ec4899', '#06b6d4', '#14b8a6', '#84cc16', '#6366f1',
];

function EventTypesSettings({ eventTypes, onSave }: {
  eventTypes: { key: string; label: string; color: string }[];
  onSave: (types: { key: string; label: string; color: string }[]) => Promise<any>;
}) {
  const [types, setTypes] = useState(eventTypes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleSave = async (updated: typeof types) => {
    setSaving(true);
    await onSave(updated);
    setTypes(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addType = () => {
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (types.some(t => t.key === key)) { alert('An event type with this name already exists'); return; }
    const updated = [...types, { key, label: newLabel.trim(), color: newColor }];
    handleSave(updated);
    setNewLabel('');
    setNewColor('#3b82f6');
    setAddingNew(false);
  };

  const removeType = (key: string) => {
    if (!confirm(`Remove "${types.find(t => t.key === key)?.label}" event type?`)) return;
    handleSave(types.filter(t => t.key !== key));
  };

  const renameType = (key: string) => {
    if (!editLabel.trim()) { setEditingKey(null); return; }
    handleSave(types.map(t => t.key === key ? { ...t, label: editLabel.trim() } : t));
    setEditingKey(null);
  };

  const changeColor = (key: string, color: string) => {
    handleSave(types.map(t => t.key === key ? { ...t, color } : t));
  };

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">Event Types</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customise the event types in your diary</p>
        </div>
        {saved && <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
      </div>

      <div className="space-y-2 mb-4">
        {types.map(type => (
          <div key={type.key} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg group">
            {/* Color picker */}
            <div className="relative">
              <input
                type="color"
                value={type.color}
                onChange={e => changeColor(type.key, e.target.value)}
                className="w-6 h-6 rounded-full border-0 cursor-pointer"
                style={{ background: type.color }}
              />
            </div>

            {/* Label — click to edit */}
            {editingKey === type.key ? (
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                onBlur={() => renameType(type.key)}
                onKeyDown={e => { if (e.key === 'Enter') renameType(type.key); if (e.key === 'Escape') setEditingKey(null); }}
                autoFocus
                className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <button
                onClick={() => { setEditingKey(type.key); setEditLabel(type.label); }}
                className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 transition"
              >
                {type.label}
                <span className="text-gray-300 text-xs ml-2 opacity-0 group-hover:opacity-100">click to rename</span>
              </button>
            )}

            {/* Key badge */}
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">{type.key}</span>

            {/* Delete */}
            <button
              onClick={() => removeType(type.key)}
              className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="w-8 h-8 rounded-lg border cursor-pointer"
            />
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addType(); if (e.key === 'Escape') setAddingNew(false); }}
              autoFocus
              placeholder="Event type name"
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addType} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
              Add Type
            </button>
            <button onClick={() => { setAddingNew(false); setNewLabel(''); }} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
        >
          + Add Event Type
        </button>
      )}
    </div>
  );
}


// ============================================
// CUSTOMER FIELDS SETTINGS
// ============================================

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
];

function CustomerFieldsSettings({ fields, onSave }: {
  fields: { key: string; label: string; type: string; options?: string[] }[];
  onSave: (fields: { key: string; label: string; type: string; options?: string[] }[]) => Promise<any>;
}) {
  const [localFields, setLocalFields] = useState(fields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');
  const [newOptions, setNewOptions] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleSave = async (updated: typeof localFields) => {
    setSaving(true);
    await onSave(updated);
    setLocalFields(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addField = () => {
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (localFields.some(f => f.key === key)) { alert('A field with this name already exists'); return; }
    const field: any = { key, label: newLabel.trim(), type: newType };
    if (newType === 'select' && newOptions.trim()) {
      field.options = newOptions.split(',').map(o => o.trim()).filter(Boolean);
    }
    handleSave([...localFields, field]);
    setNewLabel('');
    setNewType('text');
    setNewOptions('');
    setAddingNew(false);
  };

  const removeField = (key: string) => {
    if (!confirm(`Remove "${localFields.find(f => f.key === key)?.label}" field? Existing data won't be deleted.`)) return;
    handleSave(localFields.filter(f => f.key !== key));
  };

  const renameField = (key: string) => {
    if (!editLabel.trim()) { setEditingKey(null); return; }
    handleSave(localFields.map(f => f.key === key ? { ...f, label: editLabel.trim() } : f));
    setEditingKey(null);
  };

  const moveField = (idx: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= localFields.length) return;
    const updated = [...localFields];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    handleSave(updated);
  };

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">Custom Customer Fields</h3>
          <p className="text-sm text-gray-500 mt-0.5">Add extra fields to customer records</p>
        </div>
        {saved && <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
      </div>

      {localFields.length === 0 && !addingNew && (
        <div className="text-center py-6 mb-4">
          <p className="text-sm text-gray-400">No custom fields yet</p>
          <p className="text-xs text-gray-300 mt-1">Add fields like "Bedrooms", "Budget", "Property Type" etc.</p>
        </div>
      )}

      {localFields.length > 0 && (
        <div className="space-y-2 mb-4">
          {localFields.map((field, idx) => (
            <div key={field.key} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg group">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveField(idx, 'up')} className="text-gray-300 hover:text-gray-600 transition text-[10px]">▲</button>
                <button onClick={() => moveField(idx, 'down')} className="text-gray-300 hover:text-gray-600 transition text-[10px]">▼</button>
              </div>

              {/* Label — click to edit */}
              {editingKey === field.key ? (
                <input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onBlur={() => renameField(field.key)}
                  onKeyDown={e => { if (e.key === 'Enter') renameField(field.key); if (e.key === 'Escape') setEditingKey(null); }}
                  autoFocus
                  className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              ) : (
                <button
                  onClick={() => { setEditingKey(field.key); setEditLabel(field.label); }}
                  className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 transition"
                >
                  {field.label}
                  <span className="text-gray-300 text-xs ml-2 opacity-0 group-hover:opacity-100">click to rename</span>
                </button>
              )}

              {/* Type badge */}
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-medium">
                {FIELD_TYPES.find(ft => ft.value === field.type)?.label || field.type}
              </span>

              {/* Options count for select fields */}
              {field.type === 'select' && field.options && (
                <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                  {field.options.length} options
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => removeField(field.key)}
                className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {addingNew ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addField(); if (e.key === 'Escape') setAddingNew(false); }}
              autoFocus
              placeholder="Field name (e.g. Bedrooms)"
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>
          {newType === 'select' && (
            <input
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              placeholder="Options (comma separated): Small, Medium, Large"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          )}
          <div className="flex gap-2">
            <button onClick={addField} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
              Add Field
            </button>
            <button onClick={() => { setAddingNew(false); setNewLabel(''); }} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
        >
          + Add Custom Field
        </button>
      )}
    </div>
  );
}


// ============================================
// DEAL MODAL
// ============================================

function DealModal({ deal, stages, onSave, onClose }: { deal: Deal | null; stages: PipelineStage[]; onSave: (deal: Partial<Deal>) => void; onClose: () => void; }) {
  const [form, setForm] = useState({ customer_name: deal?.customer_name || '', customer_email: deal?.customer_email || '', customer_phone: deal?.customer_phone || '', moving_from: deal?.moving_from || '', moving_to: deal?.moving_to || '', moving_date: deal?.moving_date || '', estimated_value: deal?.estimated_value?.toString() || '', notes: deal?.notes || '', stage_id: deal?.stage_id || stages[0]?.id || '' });

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
          <select value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
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

function EventModal({ event, onSave, onClose, emailConnected, prefillDate, eventTypes }: { event: DiaryEvent | null; onSave: (e: Partial<DiaryEvent>, recipientEmail?: string) => void; onClose: () => void; emailConnected?: boolean; prefillDate?: Date | null; eventTypes?: { key: string; label: string; color: string }[]; }) {
  const formatForInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  };
  const defaultStart = event?.start_time ? event.start_time.slice(0, 16) : prefillDate ? formatForInput(prefillDate) : '';
  const defaultEnd = event?.end_time ? event.end_time.slice(0, 16) : prefillDate ? formatForInput(new Date(prefillDate.getTime() + 60 * 60 * 1000)) : '';
  const [form, setForm] = useState({ title: event?.title || '', description: event?.description || '', start_time: defaultStart, end_time: defaultEnd, event_type: event?.event_type || 'job', customer_name: event?.customer_name || '', location: event?.location || '', customer_email: '' });
  const [sendEmail, setSendEmail] = useState(!!emailConnected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{event ? 'Edit Event' : 'New Event'}</h2>
        <div className="space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Event title *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">{(eventTypes || [{ key: 'job', label: 'Job' }, { key: 'survey', label: 'Survey' }, { key: 'callback', label: 'Callback' }, { key: 'delivery', label: 'Delivery' }, { key: 'packing', label: 'Packing' }, { key: 'other', label: 'Other' }]).map(et => (<option key={et.key} value={et.key}>{et.label}</option>))}</select>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Start time *</label><input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">End time</label><input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          </div>
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="Customer email (for confirmation)" type="email" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          {emailConnected && form.customer_email && !event && (
            <label className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
              <div><p className="text-sm font-medium text-green-800">Send confirmation email</p><p className="text-xs text-green-600">Email will be sent to {form.customer_email}</p></div>
            </label>
          )}
          {!emailConnected && !event && form.customer_email && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">💡 Connect Gmail in Settings to auto-send confirmation emails</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => { if (!form.title.trim()) return alert('Title is required'); if (!form.start_time) return alert('Start time is required'); const eventData: any = { title: form.title, event_type: form.event_type, start_time: new Date(form.start_time).toISOString(), end_time: form.end_time ? new Date(form.end_time).toISOString() : null, description: form.description || null, customer_name: form.customer_name || null, location: form.location || null }; onSave(eventData, sendEmail && form.customer_email ? form.customer_email : undefined); }} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">{event ? 'Update' : 'Create'} Event</button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CUSTOMER MODAL
// ============================================

function CustomerModal({ customer, stages, onSave, onClose, customFields, customSources }: { customer: Customer | null; stages: PipelineStage[]; onSave: (c: Partial<Customer>, stageId?: string) => void; onClose: () => void; customFields?: { key: string; label: string; type: string; options?: string[] }[]; customSources?: string[]; }) {
  const [form, setForm] = useState({ name: customer?.name || '', email: customer?.email || '', phone: customer?.phone || '', address: customer?.address || '', notes: customer?.notes || '', source: customer?.source || '', moving_from: customer?.moving_from || '', moving_to: customer?.moving_to || '', moving_date: customer?.moving_date || '' });
  const [selectedStage, setSelectedStage] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>((customer as any)?.custom_fields || {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{customer ? 'Edit Customer' : 'New Customer'}</h2>
        <div className="space-y-4">
          <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Customer Details</p>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name *" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2">{(form.email || '').split(',').map((em, idx) => (<div key={idx} className="flex items-center gap-1.5"><input value={em.trim()} onChange={(e) => { const emails = (form.email || '').split(',').map(x => x.trim()); emails[idx] = e.target.value; setForm({ ...form, email: emails.filter((x, i) => x || i === 0).join(', ') }); }} placeholder={idx === 0 ? "Email" : "Additional email"} type="email" className="flex-1 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />{idx > 0 && (<button type="button" onClick={() => { const emails = (form.email || '').split(',').map(x => x.trim()).filter((_, i) => i !== idx); setForm({ ...form, email: emails.join(', ') }); }} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>)}</div>))}<button type="button" onClick={() => setForm({ ...form, email: (form.email || '') + ', ' })} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition">+ Add email</button></div><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" type="tel" className="px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-fit" /></div>
             <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"><option value="">Source (how did they find you?)</option>{(customSources || ['Website','Phone Call','Referral','Social Media','Walk-in','Other']).map(s => <option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>
          <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Move Details</p>
            <div className="space-y-3">
              <input value={form.moving_from} onChange={(e) => setForm({ ...form, moving_from: e.target.value })} placeholder="Moving from address" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <input value={form.moving_to} onChange={(e) => setForm({ ...form, moving_to: e.target.value })} placeholder="Moving to address" className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <div><label className="text-xs text-gray-500 mb-1 block">Preferred moving date</label><input type="date" value={form.moving_date} onChange={(e) => setForm({ ...form, moving_date: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
          </div>
          {!customer && stages.length > 0 && (
            <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pipeline</p>
              <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"><option value="">No pipeline stage (customer only)</option>{stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              {selectedStage && <p className="text-xs text-blue-600 mt-1.5">A deal will be automatically created in the selected pipeline stage.</p>}
            </div>
          )}
          <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." rows={3} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div>
          {customFields && customFields.length > 0 && (
            <div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Additional Information</p>
              <div className="space-y-3">
                {customFields.map(field => (
                  <div key={field.key}>
                    <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea value={customFieldValues[field.key] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))} rows={2} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder={field.label} />
                    ) : field.type === 'select' ? (
                      <select value={customFieldValues[field.key] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Select...</option>
                        {(field as any).options?.map((opt: string) => (<option key={opt} value={opt}>{opt}</option>))}
                      </select>
                    ) : (
                      <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={customFieldValues[field.key] || ''} onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder={field.label} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => { if (!form.name.trim()) return alert('Name is required'); onSave({ name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || form.moving_from || null, notes: form.notes || null, source: form.source || null, moving_from: form.moving_from || null, moving_to: form.moving_to || null, moving_date: form.moving_date || null, custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined } as any, selectedStage || undefined); }} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">{customer ? 'Update' : 'Create'} Customer{selectedStage ? ' + Deal' : ''}</button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DEAL DETAIL POPUP
// ============================================

function DealDetailPopup({ deal, stages, events, onClose, onBookAppointment, onEditDeal, onDeleteDeal, onCreateQuote, onDayPlan, onPrintInvoice }: { deal: Deal; stages: PipelineStage[]; events: DiaryEvent[]; onClose: () => void; onBookAppointment: () => void; onEditDeal: () => void; onDeleteDeal: () => void; onCreateQuote: () => void; onDayPlan: () => void; onPrintInvoice: () => void; }) {
  const stage = stages.find((s) => s.id === deal.stage_id);
  const linkedEvents = events.filter((e) => e.deal_id === deal.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-bold text-gray-900">{deal.customer_name}</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">{deal.customer_email && <span className="flex items-center gap-1.5 text-gray-600">📧 {deal.customer_email}</span>}{deal.customer_phone && <span className="flex items-center gap-1.5 text-gray-600">📱 {deal.customer_phone}</span>}</div>
          {(deal.moving_from || deal.moving_to) && <p className="text-sm text-gray-700">📍 {deal.moving_from || '—'} → {deal.moving_to || '—'}</p>}
          <div className="flex flex-wrap items-center gap-3">{deal.moving_date && <span className="text-sm text-gray-600">📅 {new Date(deal.moving_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}{deal.estimated_value && <span className="text-sm font-bold text-green-600">💰 £{deal.estimated_value.toLocaleString()}</span>}</div>
          {stage && <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Stage:</span><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.name}</span></div>}
          {deal.notes && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{deal.notes}</p>}
          {linkedEvents.length > 0 && (<div><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Booked Appointments</p>{linkedEvents.map((evt) => (<div key={evt.id} className="flex items-center gap-2 text-sm text-gray-600 mb-1"><span>📅</span><span>{new Date(evt.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {new Date(evt.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{evt.event_type}</span>{evt.completed && <span className="text-green-500">✓</span>}</div>))}</div>)}
        </div>
        <div className="p-5 pt-0 flex flex-wrap gap-2">
          <button onClick={onBookAppointment} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">📅 Schedule</button>
         <button onClick={onCreateQuote} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">📸 Create Quote</button>
          <button onClick={onDayPlan} className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition">🗓 Day Plan</button>
          <button onClick={onPrintInvoice} className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">🧾 Invoice</button>
          <button onClick={onEditDeal} className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">✏️ Edit</button>
          <button onClick={onDeleteDeal} className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition">🗑️ Delete</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// QUICK BOOK EVENT MODAL
// ============================================

function QuickBookEventModal({ deal, onSave, onClose, eventTypes }: { deal: Deal; onSave: (event: Partial<DiaryEvent>) => void; onClose: () => void; eventTypes?: { key: string; label: string; color: string }[]; }) {
  const [form, setForm] = useState({ event_type: 'survey', start_time: '', end_time: '' });
  const title = `${form.event_type.charAt(0).toUpperCase() + form.event_type.slice(1)} — ${deal.customer_name}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Book Appointment</h2>
        <p className="text-sm text-gray-500 mb-5">For {deal.customer_name}</p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Type</label><select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">{(eventTypes || [{ key: 'survey', label: 'Survey' }, { key: 'job', label: 'Job' }, { key: 'callback', label: 'Callback' }, { key: 'delivery', label: 'Delivery' }, { key: 'other', label: 'Other' }]).map(et => (<option key={et.key} value={et.key}>{et.label}</option>))}</select></div>
          <div className="bg-gray-50 rounded-lg px-4 py-2.5"><p className="text-xs text-gray-500 mb-0.5">Event title</p><p className="text-sm font-medium text-gray-800">{title}</p></div>
          {deal.moving_from && <div className="bg-gray-50 rounded-lg px-4 py-2.5"><p className="text-xs text-gray-500 mb-0.5">Location</p><p className="text-sm font-medium text-gray-800">📍 {deal.moving_from}</p></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Start time *</label><input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">End time</label><input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => { if (!form.start_time) return alert('Start time is required'); onSave({ title, event_type: form.event_type, start_time: new Date(form.start_time).toISOString(), end_time: form.end_time ? new Date(form.end_time).toISOString() : null, customer_name: deal.customer_name, location: deal.moving_from || null, deal_id: deal.id, description: deal.notes || null }); }} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">Book Appointment</button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// EVENT DETAIL POPUP
// ============================================

function EventDetailPopup({ event, deals, onClose, onCreateQuote, onComplete, onEditEvent, onDeleteEvent }: { event: DiaryEvent; deals: Deal[]; onClose: () => void; onCreateQuote: () => void; onComplete: () => void; onEditEvent: () => void; onDeleteEvent: () => void; }) {
  const linkedDeal = event.deal_id ? deals.find((d) => d.id === event.deal_id) : null;
  const startTime = new Date(event.start_time);
  const endTime = event.end_time ? new Date(event.end_time) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-bold text-gray-900">{event.title}</h2><button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
        <div className="p-5 space-y-3">
          {linkedDeal && <div className="flex flex-wrap gap-3 text-sm">{linkedDeal.customer_email && <span className="flex items-center gap-1.5 text-gray-600">📧 {linkedDeal.customer_email}</span>}{linkedDeal.customer_phone && <span className="flex items-center gap-1.5 text-gray-600">📱 {linkedDeal.customer_phone}</span>}</div>}
          {(event.location || linkedDeal?.moving_from) && (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-700 flex-1">📍 {event.location || linkedDeal?.moving_from || '—'}{linkedDeal?.moving_to && ` → ${linkedDeal.moving_to}`}</p>
              
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.location || linkedDeal?.moving_from || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Directions
              </a>
            </div>
          )}
          <p className="text-sm text-gray-600">🕐 {startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{endTime && ` – ${endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</p>
          <p className="text-sm text-gray-600">📅 {startTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Status:</span><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${event.completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{event.completed ? '✅ Completed' : '○ Not completed'}</span></div>
          <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Type:</span><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 capitalize">{event.event_type}</span></div>
          {(event.description || linkedDeal?.notes) && <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{event.description || linkedDeal?.notes}</p>}
          {linkedDeal?.estimated_value && <p className="text-sm font-bold text-green-600">💰 Deal value: £{linkedDeal.estimated_value.toLocaleString()}</p>}
        </div>
        <div className="p-5 pt-0 flex flex-wrap gap-2">
          <button onClick={onCreateQuote} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">📸 Create Quote</button>
          <button onClick={onComplete} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg transition ${event.completed ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{event.completed ? '↩️ Undo Complete' : '✅ Complete'}</button>
          <button onClick={onEditEvent} className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">✏️ Edit</button>
          <button onClick={onDeleteEvent} className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition">🗑️ Delete</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// QUOTE DETAIL POPUP — EDITABLE
// ============================================

function QuoteDetailPopup({ quote, company, pdfBranding, pricingConfig, onClose, onUpdateStatus, onDelete, onConvertToDeal, onSave, onBookDiary, onDayPlan }: {
  quote: CrmQuote; company: Company; pdfBranding?: any; pricingConfig?: any; onClose: () => void; onUpdateStatus: (status: string) => void; onDelete: () => void; onConvertToDeal: () => void;
  onSave: (fields: Partial<CrmQuote>) => void;
  onBookDiary?: (quote: CrmQuote) => void;
  onDayPlan?: () => void;
}) {
  const statusStyles: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700' };

  const parseVol = (note: string) => { const m = note?.match(/~?(\d+(?:\.\d+)?)\s*ft/); return m ? parseFloat(m[1]) : 0; };

  // Editable state
  const [editPrice, setEditPrice] = useState(quote.estimated_price?.toString() || '0');
  const [editItems, setEditItems] = useState<any[]>(quote.items || []);
  const [editNotes, setEditNotes] = useState(quote.notes || '');
  const [editingNotes, setEditingNotes] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemVolume, setCustomItemVolume] = useState('');

  // Cost breakdown state — auto-populate if empty
  const autoGenCosts = () => {
    const costs: { category: string; description: string; amount: number }[] = [];
    const rate = pricingConfig?.hourly_rate || 45;
    const fuelRate = pricingConfig?.fuel_rate_per_mile || 0.50;
    const vanRate = pricingConfig?.van_cost_per_day || 75;
    const m = quote.movers || 2;
    const h = quote.estimated_hours || (quote.total_volume_m3 <= 10 ? 3 : quote.total_volume_m3 <= 20 ? 5 : quote.total_volume_m3 <= 35 ? 7 : 9);
    const d = quote.distance_miles || 0;
    const v = quote.van_count || 1;
    if (m > 0 && h > 0) costs.push({ category: 'labour', description: `${m} movers × ${h}hrs × £${rate}/hr`, amount: m * h * rate });
    if (v > 0 && vanRate > 0) costs.push({ category: 'vehicle', description: `${v} van${v !== 1 ? 's' : ''} × £${vanRate}/day`, amount: v * vanRate });
    if (d > 0 && fuelRate > 0) costs.push({ category: 'fuel', description: `${d} miles × £${fuelRate.toFixed(2)}/mile`, amount: d * fuelRate });
    return costs;
  };

  const [editCosts, setEditCosts] = useState<{ category: string; description: string; amount: number }[]>(
    (quote.cost_breakdown && quote.cost_breakdown.length > 0) ? quote.cost_breakdown : autoGenCosts()
  );

 

  const [showCostForm, setShowCostForm] = useState(false);
  const [newCostCat, setNewCostCat] = useState('fuel');
  const [newCostDesc, setNewCostDesc] = useState('');
  const [newCostAmt, setNewCostAmt] = useState('');
  const COST_CATS = [
    { value: 'fuel', label: 'Fuel', icon: '⛽' }, { value: 'labour', label: 'Labour', icon: '👷' },
    { value: 'materials', label: 'Materials', icon: '📦' }, { value: 'packing', label: 'Packing', icon: '🎁' },
    { value: 'tolls', label: 'Tolls/Parking', icon: '🅿️' }, { value: 'storage', label: 'Storage', icon: '🏪' },
    { value: 'subcontractor', label: 'Subcontractor', icon: '🤝' }, { value: 'vehicle', label: 'Vehicle', icon: '🔧' },
    { value: 'other', label: 'Other', icon: '📋' },
  ];
  const totalCostEst = editCosts.reduce((s, c) => s + c.amount, 0);
  const currentPrice = parseFloat(editPrice) || 0;
  const profitEst = currentPrice - totalCostEst;
  const marginEst = currentPrice > 0 ? ((profitEst / currentPrice) * 100).toFixed(1) : '0';

  const COMMON_ITEMS = [
    { name: 'Sofa - 2 Seater', note: '~35 ft³' },{ name: 'Sofa - 3 Seater', note: '~45 ft³' },{ name: 'Sofa - Corner/L-Shape', note: '~60 ft³' },{ name: 'Armchair', note: '~20 ft³' },{ name: 'Coffee Table', note: '~10 ft³' },{ name: 'TV Unit / Stand', note: '~15 ft³' },{ name: 'Bookcase', note: '~25 ft³' },{ name: 'Sideboard', note: '~25 ft³' },{ name: 'Display Cabinet', note: '~30 ft³' },{ name: 'Single Bed + Mattress', note: '~40 ft³' },{ name: 'Double Bed + Mattress', note: '~55 ft³' },{ name: 'King Bed + Mattress', note: '~65 ft³' },{ name: 'Super King Bed + Mattress', note: '~75 ft³' },{ name: 'Wardrobe - Single', note: '~35 ft³' },{ name: 'Wardrobe - Double', note: '~65 ft³' },{ name: 'Chest of Drawers', note: '~20 ft³' },{ name: 'Bedside Table', note: '~5 ft³' },{ name: 'Dressing Table', note: '~15 ft³' },{ name: 'Fridge Freezer', note: '~30 ft³' },{ name: 'American Fridge Freezer', note: '~40 ft³' },{ name: 'Washing Machine', note: '~30 ft³' },{ name: 'Tumble Dryer', note: '~25 ft³' },{ name: 'Dishwasher', note: '~25 ft³' },{ name: 'Microwave', note: '~5 ft³' },{ name: 'Dining Table - 4 Seat', note: '~20 ft³' },{ name: 'Dining Table - 6 Seat', note: '~30 ft³' },{ name: 'Dining Chair', note: '~5 ft³' },{ name: 'China Cabinet', note: '~35 ft³' },{ name: 'Office Desk', note: '~20 ft³' },{ name: 'Office Chair', note: '~10 ft³' },{ name: 'Filing Cabinet', note: '~15 ft³' },{ name: 'Patio Table + 4 Chairs', note: '~25 ft³' },{ name: 'BBQ', note: '~15 ft³' },{ name: 'Lawnmower', note: '~10 ft³' },{ name: 'Small Box (Book Box)', note: '~2 ft³' },{ name: 'Medium Box', note: '~3 ft³' },{ name: 'Large Box', note: '~5 ft³' },{ name: 'Wardrobe Box', note: '~10 ft³' },{ name: 'Bicycle', note: '~10 ft³' },{ name: 'Piano - Upright', note: '~50 ft³' },{ name: 'Exercise Bike / Treadmill', note: '~20 ft³' },{ name: 'Trampoline', note: '~20 ft³' },
  ];

  const updateQuantity = (idx: number, delta: number) => {
    setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) } : item));
    setHasChanges(true);
  };

  const removeItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
    setHasChanges(true);
  };

  const addCommonItem = (common: { name: string; note: string }) => {
    const existing = editItems.findIndex(i => i.name.toLowerCase() === common.name.toLowerCase());
    if (existing >= 0) {
      updateQuantity(existing, 1);
    } else {
      setEditItems(prev => [...prev, { name: common.name, note: common.note, quantity: 1 }]);
      setHasChanges(true);
    }
    setShowAddItemModal(false);
    setItemSearch('');
  };

  const addCustomItem = () => {
    if (!customItemName.trim()) return;
    const vol = parseFloat(customItemVolume) || 10;
    setEditItems(prev => [...prev, { name: customItemName.trim(), note: `~${vol} ft³`, quantity: 1 }]);
    setCustomItemName('');
    setCustomItemVolume('');
    setShowAddItemModal(false);
    setHasChanges(true);
  };

  const totalVol = editItems.reduce((s: number, i: any) => s + parseVol(i.note || '') * (i.quantity || 1), 0);
  const totalItemCount = editItems.reduce((s: number, i: any) => s + (i.quantity || 1), 0);

  const handleSave = () => {
    onSave({ items: editItems, notes: editNotes || null, cost_breakdown: editCosts, estimated_price: editPrice ? parseFloat(editPrice) : null } as any);
    setHasChanges(false);
    setEditingNotes(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{quote.customer_name}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyles[quote.status] || statusStyles.draft}`}>{quote.status}</span>
            {hasChanges && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 animate-pulse">Unsaved changes</span>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {/* Price banner — editable */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-200">Quote Total</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold">£</span>
                <input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => { setEditPrice(e.target.value); setHasChanges(true); }}
                  className="text-3xl font-bold bg-white/10 border border-white/20 rounded-lg px-3 py-1 w-40 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
            </div>
            <div className="text-right text-sm"><p className="text-blue-200">Created</p><p className="font-medium">{new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Customer details */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Customer Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2"><span className="text-gray-400">👤</span><span className="font-medium text-gray-900">{quote.customer_name}</span></div>
              {quote.customer_email && <div className="flex items-center gap-2"><span className="text-gray-400">📧</span><span className="text-gray-700">{quote.customer_email}</span></div>}
              {quote.customer_phone && <div className="flex items-center gap-2"><span className="text-gray-400">📱</span><span className="text-gray-700">{quote.customer_phone}</span></div>}
              {quote.moving_date && <div className="flex items-center gap-2"><span className="text-gray-400">📅</span><span className="text-gray-700">{new Date(quote.moving_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>}
            </div>
          </div>

          {/* Move details */}
          {(quote.moving_from || quote.moving_to) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Move Details</p>
              <div className="flex items-center gap-3">
                <div className="flex-1"><p className="text-xs text-gray-500 mb-0.5">From</p><p className="text-sm font-medium text-gray-900">{quote.moving_from || '—'}</p></div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                <div className="flex-1"><p className="text-xs text-gray-500 mb-0.5">To</p><p className="text-sm font-medium text-gray-900">{quote.moving_to || '—'}</p></div>
              </div>
            </div>
          )}

          {/* Logistics */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Volume</p><p className="text-lg font-bold text-gray-900">{quote.total_volume_m3 || 0}</p><p className="text-xs text-gray-400">m³</p></div>
            <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Vans</p><p className="text-lg font-bold text-gray-900">{quote.van_count || 0}</p></div>
            <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Movers</p><p className="text-lg font-bold text-gray-900">{quote.movers || 0}</p></div>
            <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Items</p><p className="text-lg font-bold text-gray-900">{totalItemCount}</p></div>
          </div>
{/* COST BREAKDOWN */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost Breakdown (Internal)</p>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${parseFloat(marginEst) >= 20 ? 'text-green-600' : parseFloat(marginEst) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>Margin: {marginEst}%</span>
                <button onClick={() => setShowCostForm(true)} className="px-2 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded hover:bg-blue-700 transition">+ Add</button>
              </div>
            </div>
            {editCosts.length > 0 ? (
              <div className="space-y-1.5 mb-3">
                {editCosts.map((cost, idx) => {
                  const cat = COST_CATS.find(c => c.value === cost.category) || COST_CATS[COST_CATS.length - 1];
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 group">
                      <span className="text-sm">{cat.icon}</span>
                      <span className="text-xs text-gray-600 flex-1">{cat.label}{cost.description ? ` — ${cost.description}` : ''}</span>
                      <span className="text-xs font-bold text-red-600">-£{cost.amount.toFixed(2)}</span>
                      <button onClick={() => { setEditCosts(prev => prev.filter((_, i) => i !== idx)); setHasChanges(true); }} className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-xs font-semibold text-gray-600">Total Costs: <span className="text-red-600">£{totalCostEst.toFixed(2)}</span></span>
                  <span className={`text-xs font-bold ${profitEst >= 0 ? 'text-green-600' : 'text-red-600'}`}>Profit: £{profitEst.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-2">No costs estimated yet</p>
            )}
            {showCostForm && (
              <div className="bg-white rounded-lg p-2.5 space-y-2 border">
                <div className="grid grid-cols-3 gap-2">
                  <select value={newCostCat} onChange={e => setNewCostCat(e.target.value)} className="px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    {COST_CATS.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                  <input value={newCostDesc} onChange={e => setNewCostDesc(e.target.value)} placeholder="Description" className="px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                  <input type="number" step="0.01" value={newCostAmt} onChange={e => setNewCostAmt(e.target.value)} placeholder="£" className="px-2 py-1.5 border rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { if (!newCostAmt || parseFloat(newCostAmt) <= 0) return; setEditCosts(prev => [...prev, { category: newCostCat, description: newCostDesc, amount: parseFloat(newCostAmt) }]); setNewCostCat('fuel'); setNewCostDesc(''); setNewCostAmt(''); setHasChanges(true); }} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-semibold rounded hover:bg-blue-700 transition">Add</button>
                  <button onClick={() => { setShowCostForm(false); setNewCostDesc(''); setNewCostAmt(''); }} className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-medium rounded hover:bg-gray-200 transition">Done</button>
                </div>
              </div>
            )}
          </div>
          {/* EDITABLE Notes */}
          <div className={`rounded-xl p-4 ${editingNotes ? 'bg-white border-2 border-blue-400' : editNotes ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-dashed border-gray-300'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-semibold uppercase tracking-wider ${editingNotes ? 'text-blue-600' : editNotes ? 'text-yellow-700' : 'text-gray-500'}`}>Notes</p>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-0.5 bg-blue-50 rounded hover:bg-blue-100 transition">
                  ✏️ {editNotes ? 'Edit' : 'Add Note'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea
                  value={editNotes}
                  onChange={(e) => { setEditNotes(e.target.value); setHasChanges(true); }}
                  placeholder="Add notes about this quote..."
                  rows={3}
                  autoFocus
                  className="w-full text-sm text-gray-900 bg-transparent outline-none resize-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => { setEditingNotes(false); setEditNotes(quote.notes || ''); }} className="text-xs px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition">Cancel</button>
                  <button onClick={() => { setEditingNotes(false); setHasChanges(true); }} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Done</button>
                </div>
              </div>
            ) : (
              editNotes ? <p className="text-sm text-yellow-900">{editNotes}</p> : <p className="text-sm text-gray-400 italic">No notes yet — click Edit to add</p>
            )}
          </div>

          {/* EDITABLE Inventory */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inventory ({editItems.length} types • ~{totalVol.toFixed(0)} ft³)</p>
              <button onClick={() => setShowAddItemModal(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">+ Add Item</button>
            </div>
            {editItems.length > 0 ? (
              <div className="bg-gray-50 rounded-xl divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {editItems.map((item: any, idx: number) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between group hover:bg-gray-100 transition">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"><svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                      <span className="text-sm text-gray-800 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => updateQuantity(idx, -1)} className="w-6 h-6 rounded border text-gray-500 hover:bg-white flex items-center justify-center text-xs font-bold transition">−</button>
                      <span className="w-6 text-center text-sm font-semibold text-gray-900">{item.quantity || 1}</span>
                      <button onClick={() => updateQuantity(idx, 1)} className="w-6 h-6 rounded border text-gray-500 hover:bg-white flex items-center justify-center text-xs font-bold transition">+</button>
                      <span className="text-xs text-gray-400 w-12 text-right">{(parseVol(item.note || '') * (item.quantity || 1)).toFixed(0)} ft³</span>
                      <button onClick={() => removeItem(idx)} className="w-6 h-6 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition opacity-0 group-hover:opacity-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-400">No items yet</p>
                <button onClick={() => setShowAddItemModal(true)} className="text-sm text-blue-600 font-medium mt-1 hover:text-blue-800">+ Add your first item</button>
              </div>
            )}
          </div>
        </div>

        {/* Actions footer */}
        <div className="sticky bottom-0 bg-white border-t p-5 flex flex-wrap gap-2">
          {hasChanges && (
            <button onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition shadow-lg animate-pulse">
              💾 Save Changes
            </button>
          )}
          {onBookDiary && <button onClick={() => onBookDiary(quote)} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">📅 Book in Diary</button>}
          {onDayPlan && <button onClick={onDayPlan} className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition">🗓 Day Plan</button>}
          {quote.status === 'draft' && <button onClick={() => onUpdateStatus('sent')} className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition">📤 Mark as Sent</button>}
          {quote.status === 'sent' && (
            <>
              <button onClick={onConvertToDeal} className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">✅ Accepted</button>
              <button onClick={() => onUpdateStatus('declined')} className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-100 text-orange-700 text-sm font-semibold rounded-lg hover:bg-orange-200 transition">✗ Declined</button>
            </>
          )}
          <button onClick={async () => {
            await downloadQuotePdf({
              companyName: company?.name || 'Moving Company', companyEmail: company?.email || undefined, companyPhone: company?.phone || undefined,
              quoteRef: quote.id.slice(0, 8).toUpperCase(), quoteDate: new Date(quote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
              status: quote.status, customerName: quote.customer_name, customerEmail: quote.customer_email || undefined, customerPhone: quote.customer_phone || undefined,
              movingFrom: quote.moving_from || undefined, movingTo: quote.moving_to || undefined, movingDate: quote.moving_date || undefined,
              items: editItems || [], totalVolume: quote.total_volume_m3 || undefined, vanCount: quote.van_count || undefined, movers: quote.movers || undefined,
              estimatedPrice: quote.estimated_price || undefined, notes: editNotes || undefined,
              branding: pdfBranding || {},
            });
          }} className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-100 transition">📄 PDF</button>
          <button onClick={onDelete} className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition ml-auto">🗑️ Delete</button>
        </div>

        {/* Add Item Modal */}
        {showAddItemModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => { setShowAddItemModal(false); setItemSearch(''); }}>
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b">
                <h3 className="font-bold text-gray-900 text-lg">Add Item</h3>
                <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Search common items..." autoFocus className="w-full mt-3 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="overflow-y-auto flex-1 divide-y">
                {COMMON_ITEMS.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).map((item, idx) => (
                  <button key={idx} onClick={() => addCommonItem(item)} className="w-full px-5 py-3 text-left hover:bg-blue-50 flex items-center justify-between transition">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="text-xs text-gray-400">{item.note}</span>
                  </button>
                ))}
                {COMMON_ITEMS.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                  <div className="px-5 py-6 text-center text-gray-400 text-sm">No matching items. Add a custom item below.</div>
                )}
              </div>
              <div className="px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
                <p className="text-xs font-semibold text-gray-500 mb-2">Or add a custom item:</p>
                <div className="flex gap-2">
                  <input value={customItemName} onChange={(e) => setCustomItemName(e.target.value)} placeholder="Item name" className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <input value={customItemVolume} onChange={(e) => setCustomItemVolume(e.target.value)} placeholder="ft³" type="number" className="w-16 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  <button onClick={addCustomItem} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">Add</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ============================================
// STAGE COLORS
// ============================================
// ============================================
// COMPOSE EMAIL MODAL
// ============================================
// ============================================
// CUSTOMER DETAIL POPUP
// ============================================

function CustomerDetailPopup({ customer, notes, tasks, files, deal, stages, onClose, onAddNote, onDeleteNote, onAddTask, onToggleTask, onDeleteTask, onUploadFile, onDeleteFile, onEditCustomer, onComposeEmail, emailConnected, onSchedule, onCreateQuote, onDeleteDeal, events, quotes, onClickQuote, onDayPlan, onPrintInvoice, customFields, onBookEvent }: {
  customer: Customer;
  notes: CustomerNote[];
  tasks: CustomerTask[];
  files: CustomerFile[];
  deal?: Deal | null;
  stages?: PipelineStage[];
  onClose: () => void;
  onAddNote: (text: string) => Promise<any>;
  onDeleteNote: (noteId: string) => void;
  onAddTask: (title: string, dueDate: string) => Promise<any>;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onDeleteTask: (taskId: string) => void;
  onUploadFile: (file: File) => Promise<any>;
  onDeleteFile: (fileId: string, fileUrl: string) => void;
  onEditCustomer: () => void;
  onComposeEmail: () => void;
  emailConnected: boolean;
  onSchedule?: () => void;
  onCreateQuote?: () => void;
  onDeleteDeal?: () => void;
  events?: DiaryEvent[];
  quotes?: CrmQuote[];
  onClickQuote?: (quote: CrmQuote) => void;
  onDayPlan?: () => void;
  onPrintInvoice?: () => void;
  customFields?: { key: string; label: string; type: string }[];
  onBookEvent?: () => void;
}) {
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!customer.id) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;
    setUploading(true);
    for (const file of droppedFiles) {
      await onUploadFile(file);
    }
    setUploading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !customer.id) return;
    const selectedFiles = Array.from(e.target.files);
    setUploading(true);
    for (const file of selectedFiles) {
      await onUploadFile(file);
    }
    setUploading(false);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string | null, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (type === 'application/pdf' || ext === 'pdf') return '📄';
    if (type?.includes('word') || ['doc', 'docx'].includes(ext)) return '📝';
    if (type?.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    return '📎';
  };

  const handleAddNote = async () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAddNote(trimmed);
    setNewNote('');
    setSaving(false);
    noteInputRef.current?.focus();
  };

  const handleAddTask = async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !newTaskDueDate) return;
    setSavingTask(true);
    await onAddTask(trimmed, new Date(newTaskDueDate).toISOString());
    setNewTaskTitle('');
    setNewTaskDueDate('');
    setShowAddTask(false);
    setSavingTask(false);
  };

  const setQuickDate = (offset: string) => {
    const d = new Date();
    if (offset === 'tomorrow') d.setDate(d.getDate() + 1);
    else if (offset === '1week') d.setDate(d.getDate() + 7);
    else if (offset === '1month') d.setMonth(d.getMonth() + 1);
    else if (offset === '3months') d.setMonth(d.getMonth() + 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setNewTaskDueDate(`${yyyy}-${mm}-${dd}`);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  const formatTaskDue = (dateStr: string) => {
    const due = new Date(dateStr);
    const now = new Date();
    // Reset times to compare dates only
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      if (absDays === 1) return '1 day overdue';
      if (absDays < 7) return `${absDays} days overdue`;
      if (absDays < 30) return `${Math.floor(absDays / 7)} week${Math.floor(absDays / 7) !== 1 ? 's' : ''} overdue`;
      return `${Math.floor(absDays / 30)} month${Math.floor(absDays / 30) !== 1 ? 's' : ''} overdue`;
    }
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''}`;
    if (diffDays < 365) return `In ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''}`;
    return due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getTaskDueColor = (dateStr: string, completed: boolean) => {
    if (completed) return 'text-gray-400';
    const due = new Date(dateStr);
    const now = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays < 0) return 'text-red-600';
    if (diffDays === 0) return 'text-amber-600';
    return 'text-gray-500';
  };

  const getTaskDueBg = (dateStr: string, completed: boolean) => {
    if (completed) return 'bg-gray-50';
    const due = new Date(dateStr);
    const now = new Date();
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays < 0) return 'bg-red-50';
    if (diffDays === 0) return 'bg-amber-50';
    return 'bg-gray-50';
  };

  const stage = deal && stages ? stages.find(s => s.id === deal.stage_id) : null;
  const linkedEvents = deal && events ? events.filter(e => e.deal_id === deal.id) : [];

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg flex-shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
              <p className="text-sm text-gray-500">{customer.email || 'No email'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {/* Contact & Move Info */}
          <div className="px-6 py-4 border-b bg-gray-50 space-y-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {customer.phone && <span className="text-gray-600">📱 {customer.phone}</span>}
              {customer.source && <span className="text-gray-600">📣 {customer.source}</span>}
              {(customer.total_revenue || (deal?.estimated_value)) ? <span className="text-green-600 font-semibold">💰 £{(customer.total_revenue || deal?.estimated_value || 0).toLocaleString()}</span> : null}
            </div>
            {(customer.moving_from || deal?.moving_from) && (
              <p className="text-sm text-gray-600">🏠 {customer.moving_from || deal?.moving_from}{(customer.moving_to || deal?.moving_to) ? ` → ${customer.moving_to || deal?.moving_to}` : ''}</p>
            )}
            {(customer.moving_date || deal?.moving_date) && (
              <p className="text-sm text-gray-600">📅 Moving: {new Date(customer.moving_date || deal?.moving_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            )}
            {customFields && customFields.length > 0 && (customer as any)?.custom_fields && Object.keys((customer as any).custom_fields).length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-1">
                {customFields.map(field => {
                  const val = (customer as any).custom_fields?.[field.key];
                  if (!val) return null;
                  return (<span key={field.key} className="text-gray-600"><span className="text-gray-400 text-xs">{field.label}:</span> {val}</span>);
                })}
              </div>
            )}

            {/* Deal stage badge */}
            {stage && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500">Stage:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </span>
              </div>
            )}

            {/* Linked events */}
            {linkedEvents.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Booked Appointments</p>
                {linkedEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center gap-2 text-sm text-gray-600 mb-0.5">
                    <span>📅</span>
                    <span>{new Date(evt.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {new Date(evt.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{evt.event_type}</span>
                    {evt.completed && <span className="text-green-500">✓</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Deal notes (from deal.notes) */}
            {deal?.notes && (
              <p className="text-sm text-gray-500 bg-white rounded-lg p-3 border border-gray-200">{deal.notes}</p>
            )}
          </div>

          {/* Quick actions */}
          <div className="px-6 py-3 border-b flex flex-wrap gap-2">
            {onSchedule ? (
              <button onClick={onSchedule} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">📅 Schedule</button>
            ) : onBookEvent ? (
              <button onClick={onBookEvent} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">📅 Book Event</button>
            ) : null}
            {onCreateQuote && (
              <button onClick={onCreateQuote} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">📸 Create Quote</button>
            )}
            <button onClick={onEditCustomer} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">✏️ Edit</button>
            {customer.email && (
              <button onClick={onComposeEmail} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
                {emailConnected ? '✉️ Send Email' : '✉️ Email'}
              </button>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">📞 Call</a>
            )}
            {onDayPlan && <button onClick={onDayPlan} className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition">🗓 Day Plan</button>}
            {onPrintInvoice && <button onClick={onPrintInvoice} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">🧾 Invoice</button>}
            {onDeleteDeal && (
              <button onClick={onDeleteDeal} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition ml-auto">🗑️ Delete</button>
            )}
          </div>
 {/* ════════════════════════════════════════════ */}
          {/* QUOTES SECTION */}
          {/* ════════════════════════════════════════════ */}
          {quotes && quotes.length > 0 && (
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  Quotes
                  <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{quotes.length}</span>
                </h3>
              </div>
              <div className="space-y-2">
                {quotes.map((q) => {
                  const statusStyles: Record<string, string> = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-green-100 text-green-700', declined: 'bg-red-100 text-red-700' };
                  const totalCosts = (q.cost_breakdown || []).reduce((s: number, c: any) => s + (c.amount || 0), 0);
                  const margin = q.estimated_price && q.estimated_price > 0 ? (((q.estimated_price - totalCosts) / q.estimated_price) * 100).toFixed(0) : null;
                  return (
                    <button
                      key={q.id}
                      onClick={() => onClickQuote && onClickQuote(q)}
                      className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-3.5 transition group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${statusStyles[q.status] || statusStyles.draft}`}>{q.status}</span>
                        <span className="text-lg font-bold text-gray-900">£{(q.estimated_price || 0).toLocaleString()}</span>
                      </div>
                      {(q.moving_from || q.moving_to) && (
                        <p className="text-xs text-gray-500 mb-1.5">{q.moving_from || '—'} → {q.moving_to || '—'}</p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-gray-400">
                        {q.total_volume_m3 ? <span>{q.total_volume_m3} m³</span> : null}
                        {q.van_count ? <span>{q.van_count} van{q.van_count !== 1 ? 's' : ''}</span> : null}
                        {q.movers ? <span>{q.movers} movers</span> : null}
                        {margin && (
                          <span className={`font-semibold ${parseFloat(margin) >= 20 ? 'text-green-600' : parseFloat(margin) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                            {margin}% margin
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-300 mt-1.5">{new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* ════════════════════════════════════════════ */}
          {/* TASKS SECTION — NEW */}
          {/* ════════════════════════════════════════════ */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Tasks
                {pendingTasks.length > 0 && (
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{pendingTasks.length}</span>
                )}
              </h3>
              {customer.id && !showAddTask && (
                <button
                  onClick={() => { setShowAddTask(true); setTimeout(() => taskInputRef.current?.focus(), 50); }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  + Add Task
                </button>
              )}
            </div>

            {/* Add Task Form */}
            {showAddTask && customer.id && (
              <div className="mb-4 p-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50">
                <input
                  ref={taskInputRef}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title (e.g. Call back about quote)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2 bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskTitle.trim() && newTaskDueDate) handleAddTask();
                    if (e.key === 'Escape') { setShowAddTask(false); setNewTaskTitle(''); setNewTaskDueDate(''); }
                  }}
                />
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button onClick={() => setQuickDate('tomorrow')} className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition ${newTaskDueDate === (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })() ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Tomorrow</button>
                  <button onClick={() => setQuickDate('1week')} className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition ${(() => { const d = new Date(); d.setDate(d.getDate() + 7); return newTaskDueDate === d.toISOString().split('T')[0]; })() ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>1 Week</button>
                  <button onClick={() => setQuickDate('1month')} className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition ${(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return newTaskDueDate === d.toISOString().split('T')[0]; })() ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>1 Month</button>
                  <button onClick={() => setQuickDate('3months')} className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition ${(() => { const d = new Date(); d.setMonth(d.getMonth() + 3); return newTaskDueDate === d.toISOString().split('T')[0]; })() ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>3 Months</button>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="text-[11px] px-2.5 py-1 border border-gray-200 rounded-md text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAddTask(false); setNewTaskTitle(''); setNewTaskDueDate(''); }}
                    className="flex-1 text-xs py-1.5 bg-white border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTask}
                    disabled={!newTaskTitle.trim() || !newTaskDueDate || savingTask}
                    className="flex-1 text-xs py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingTask ? 'Adding...' : 'Add Task'}
                  </button>
                </div>
              </div>
            )}

            {/* Task List */}
            {tasks.length === 0 && !showAddTask ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400">No tasks yet</p>
                {customer.id && <p className="text-xs text-gray-300 mt-1">Add reminders and follow-ups</p>}
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Pending tasks first */}
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-xl transition ${getTaskDueBg(task.due_date, task.completed)}`}
                  >
                    <button
                      onClick={() => onToggleTask(task.id, !task.completed)}
                      className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5 transition"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium">{task.title}</p>
                      <p className={`text-[11px] font-semibold ${getTaskDueColor(task.due_date, task.completed)}`}>
                        {formatTaskDue(task.due_date)}
                        <span className="font-normal text-gray-400 ml-1.5">
                          · {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => { if (confirm('Delete this task?')) onDeleteTask(task.id); }}
                      className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                      title="Delete task"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Completed tasks */}
                {completedTasks.length > 0 && (
                  <>
                    {pendingTasks.length > 0 && <div className="border-t border-gray-100 my-1" />}
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-start gap-2.5 px-3 py-2 rounded-xl bg-gray-50 opacity-60 hover:opacity-80 transition"
                      >
                        <button
                          onClick={() => onToggleTask(task.id, !task.completed)}
                          className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5 transition hover:bg-green-600"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 line-through">{task.title}</p>
                          <p className="text-[11px] text-gray-400">
                            {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button
                          onClick={() => { if (confirm('Delete this task?')) onDeleteTask(task.id); }}
                          className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════ */}
          {/* FILES SECTION — NEW */}
          {/* ════════════════════════════════════════════ */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                Files
                {files.length > 0 && (
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{files.length}</span>
                )}
              </h3>
              {customer.id && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  + Upload
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Drag & Drop Zone */}
            {customer.id && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-all mb-3 ${
                  dragOver
                    ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 py-1">
                    <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-blue-600 font-medium">Uploading...</span>
                  </div>
                ) : (
                  <div className="py-1">
                    <p className="text-sm text-gray-500">
                      {dragOver ? (
                        <span className="text-blue-600 font-medium">Drop files here</span>
                      ) : (
                        <>Drag & drop files here or <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 font-medium hover:text-blue-800">browse</button></>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Floor plans, photos, contracts, etc.</p>
                  </div>
                )}
              </div>
            )}

            {/* File List */}
            {files.length === 0 ? (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">No files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {files.map((file) => (
                  <div key={file.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                    <span className="text-lg flex-shrink-0">{getFileIcon(file.file_type, file.file_name)}</span>
                    <div className="flex-1 min-w-0">
                      <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-800 hover:text-blue-600 transition truncate block">
                        {file.file_name}
                      </a>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                        <span>{new Date(file.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition opacity-0 group-hover:opacity-100 flex-shrink-0" title="Download">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                    <button
                      onClick={() => { if (confirm(`Delete ${file.file_name}?`)) onDeleteFile(file.id, file.file_url); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="px-6 py-4">


            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Notes</h3>
              <span className="text-xs text-gray-400">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Add Note */}
            {customer.id && (
              <div className="mb-4">
                <textarea
                  ref={noteInputRef}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote();
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-gray-400">Ctrl+Enter to save</p>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || saving}
                    className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Add Note'}
                  </button>
                </div>
              </div>
            )}

            {/* Notes Timeline */}
            {notes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">No notes yet</p>
                {customer.id && <p className="text-xs text-gray-300 mt-1">Add your first note above</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="group relative bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap flex-1">{note.note_text}</p>
                      <button
                        onClick={() => { if (confirm('Delete this note?')) onDeleteNote(note.id); }}
                        className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                        title="Delete note"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t">
          <button onClick={onClose} className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const EMAIL_TEMPLATES = [
  {
    label: '📋 Survey reminder',
    subject: 'Home Survey Reminder',
    body: `Just a quick reminder about your upcoming home survey.\n\nWe'll be visiting to assess your items and provide an accurate quote for your move. Please make sure all rooms are accessible.\n\nIf you need to reschedule, just let us know.`,
  },
  {
    label: '💬 Quote follow-up',
    subject: 'Following Up on Your Moving Quote',
    body: `I wanted to follow up on the quote we sent over recently.\n\nHave you had a chance to review it? If you have any questions or would like to discuss the details, I'm happy to help.\n\nWe'd love to help make your move as smooth as possible.`,
  },
  {
    label: '🚛 Moving day confirmation',
    subject: 'Moving Day Confirmation',
    body: `This is to confirm everything is set for your moving day.\n\nOur team will arrive at the agreed time. Please ensure parking is available and any items you don't want moved are clearly marked.\n\nLooking forward to helping with your move!`,
  },
  {
    label: '🙏 Thank you',
    subject: 'Thank You for Choosing Us',
    body: `Thank you for choosing us for your recent move. We hope everything went smoothly!\n\nIf you were happy with our service, we'd really appreciate a review — it helps other families find us.\n\nWishing you all the best in your new home!`,
  },
  {
    label: '✅ Booking confirmation',
    subject: 'Your Move is Booked!',
    body: `Great news — your move is officially booked and confirmed!\n\nWe'll be in touch closer to the date with final details including arrival time and crew information. In the meantime, if anything changes or you have questions, just reply to this email.\n\nWe're looking forward to making your move day stress-free.`,
  },
  {
    label: '⭐ Review request',
    subject: 'How Did We Do?',
    body: `We hope you're settling into your new home nicely!\n\nWe'd really appreciate it if you could take a moment to leave us a quick review. It only takes a minute and it makes a huge difference in helping other families find a trusted moving company.\n\nThank you so much for choosing us — it was a pleasure helping with your move.`,
  },
  {
    label: '⏰ Quote expired',
    subject: 'Your Moving Quote Has Expired — Want a Fresh One?',
    body: `I noticed the quote we sent you recently has now expired.\n\nIf you're still planning your move, I'd be happy to put together an updated quote for you. Prices may vary depending on availability, so it's worth getting a fresh one.\n\nJust reply to this email or give us a call and we'll sort it out quickly.`,
  },
  {
    label: '💷 Payment reminder',
    subject: 'Friendly Payment Reminder',
    body: `Just a friendly reminder that we have an outstanding balance on your account.\n\nIf you've already made the payment, please disregard this message. Otherwise, we'd appreciate if you could arrange payment at your earliest convenience.\n\nIf you have any questions about the invoice, just let us know and we'll be happy to help.`,
  },
];

function ComposeEmailModal({ customer, emailConnected, companyId, onClose }: {
  customer: Customer;
  emailConnected: boolean;
  companyId: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const applyTemplate = (tpl: typeof EMAIL_TEMPLATES[0]) => {
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert('Please enter a subject and message');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/email/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          recipient_email: customer.email,
          recipient_name: customer.name,
          subject,
          body_text: body,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
        setTimeout(() => onClose(), 1500);
      } else {
        alert(data.error || 'Failed to send email. Please try again.');
      }
    } catch (err) {
      console.error('Send email error:', err);
      alert('Failed to send email. Please try again.');
    }
    setSending(false);
  };

  if (!emailConnected) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Send Email</h2>
          <p className="text-gray-500 text-sm mb-4">
            To send emails directly from the CRM, you need to connect your Gmail account first.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <p className="text-sm text-blue-800 font-medium">💡 Connect Gmail in Settings</p>
            <p className="text-xs text-blue-600 mt-1">
              Go to Settings → Email Integration → Connect Gmail. Emails will then be sent from your own Gmail address.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`mailto:${customer.email}`}
              className="flex-1 text-center py-2.5 bg-gray-100 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-200 transition"
            >
              Open in Mail App
            </a>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 transition"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
   );
  }
}

function BulkEmailModal({ recipients, emailConnected, companyId, onClose }: {
  recipients: { name: string; email: string }[];
  emailConnected: boolean;
  companyId: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ sent: number; failed: number } | null>(null);

  const quickTemplates = [
    { label: 'Follow-up', subject: 'Following up on your move', body: `Hi {name},\n\nI wanted to follow up regarding your upcoming move. Please don't hesitate to get in touch if you have any questions.\n\nBest regards` },
    { label: 'Confirmation', subject: 'Your move is confirmed', body: `Hi {name},\n\nWe're pleased to confirm your upcoming move with us. Our team will be in touch shortly with further details.\n\nBest regards` },
    { label: 'Reminder', subject: 'Reminder about your upcoming move', body: `Hi {name},\n\nThis is a friendly reminder about your upcoming move. If you have any last-minute questions or changes, please contact us as soon as possible.\n\nBest regards` },
    { label: 'Check-in', subject: 'Checking in', body: `Hi {name},\n\nI just wanted to check in and see if there's anything we can do to help as you prepare for your move.\n\nBest regards` },
  ];

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setProgress(0);
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const personalised = body.replace(/\{name\}/g, r.name.split(' ')[0]);
      try {
        const res = await fetch('/api/email/send-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, recipient_email: r.email, recipient_name: r.name, subject, body_text: personalised }),
        });
        res.ok ? sent++ : failed++;
      } catch { failed++; }
      setProgress(Math.round(((i + 1) / recipients.length) * 100));
      if (i < recipients.length - 1) await new Promise(res => setTimeout(res, 200));
    }
    setSending(false);
    setResults({ sent, failed });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Email</h2>
            <p className="text-sm text-gray-500 mt-0.5">{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {results ? (
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Emails Sent</h3>
            <p className="text-gray-500 mb-1"><span className="font-semibold text-green-600">{results.sent}</span> sent successfully</p>
            {results.failed > 0 && <p className="text-gray-500 mb-4"><span className="font-semibold text-red-500">{results.failed}</span> failed</p>}
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition text-sm">Done</button>
          </div>
        ) : sending ? (
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Sending...</h3>
            <p className="text-sm text-gray-500 mb-5">{progress}% complete</p>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {!emailConnected && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
                ⚠️ Gmail not connected. Connect your email in Settings to send emails.
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recipients</p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {recipients.map((r, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 rounded-lg">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600 flex-shrink-0">
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{r.email}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Use <code className="bg-gray-100 px-1 rounded">{'{name}'}</code> to personalise with first name.</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Templates</p>
              <div className="flex flex-wrap gap-1.5">
                {quickTemplates.map(t => (
                  <button key={t.label} onClick={() => { setSubject(t.subject); setBody(t.body); }}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-600 rounded-lg text-xs font-medium transition">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} placeholder="Write your message here..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition text-sm">Cancel</button>
              <button onClick={handleSend} disabled={!subject.trim() || !body.trim() || !emailConnected}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Send to {recipients.length}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
);
}

function ComposeEmailModalMain({ customer, emailConnected, companyId, onClose }: { customer: Customer; emailConnected: boolean; companyId: string; onClose: () => void; }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const applyTemplate = (tpl: typeof EMAIL_TEMPLATES[0]) => { setSubject(tpl.subject); setBody(tpl.body); };
  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { alert('Please enter a subject and message'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/email/send-custom', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId, recipient_email: customer.email, recipient_name: customer.name, subject, body_text: body }) });
      const data = await res.json();
      if (data.success) { setSent(true); setTimeout(() => onClose(), 1500); } else { alert(data.error || 'Failed to send email.'); }
    } catch (err) { alert('Failed to send email.'); }
    setSending(false);
  };
  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Email Sent!</h2>
          <p className="text-sm text-gray-500">Your email to {customer.name} has been sent from your Gmail.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Send Email</h2>
            <p className="text-sm text-gray-500 mt-0.5">via connected Gmail</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* To field (read-only) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">To</label>
            <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                <p className="text-xs text-gray-500 truncate">{customer.email}</p>
              </div>
            </div>
          </div>

          {/* Quick templates */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATES.map((tpl, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(tpl)}
                  className="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={6}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          <p className="text-xs text-gray-400">
            Your company branding, logo, and social links will be included automatically.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3">
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!subject.trim() || !body.trim() || sending}
            className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


const STAGE_COLORS = [
  { hex: '#22c55e', name: 'Green' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#84cc16', name: 'Lime' },
];

// ============================================
// STAGE MANAGER MODAL
// ============================================

function StageManagerModal({ stages, deals, onClose, onAddStage, onUpdateStage, onReorderStages, onDeleteStage }: {
  stages: PipelineStage[];
  deals: Deal[];
  onClose: () => void;
  onAddStage: (name: string, color: string) => Promise<any>;
  onUpdateStage: (stageId: string, updates: Partial<PipelineStage>) => Promise<any>;
  onReorderStages: (stages: PipelineStage[]) => Promise<void>;
  onDeleteStage: (stageId: string, moveToId: string | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(STAGE_COLORS[0].hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [deleteStageData, setDeleteStageData] = useState<PipelineStage | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const dealCountFor = (stageId: string) => deals.filter(d => d.stage_id === stageId).length;

  useEffect(() => {
    if (addingNew && newNameRef.current) newNameRef.current.focus();
  }, [addingNew]);

  useEffect(() => {
    if (editingId && editNameRef.current) {
      editNameRef.current.focus();
      editNameRef.current.select();
    }
  }, [editingId]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAddStage(trimmed, newColor);
    setNewName('');
    setNewColor(STAGE_COLORS[Math.floor(Math.random() * STAGE_COLORS.length)].hex);
    setAddingNew(false);
    setSaving(false);
  };

  const handleRename = async (stageId: string) => {
    const trimmed = editName.trim();
    const stage = stages.find(s => s.id === stageId);
    if (trimmed && stage && trimmed !== stage.name) {
      setSaving(true);
      await onUpdateStage(stageId, { name: trimmed });
      setSaving(false);
    }
    setEditingId(null);
  };

  const handleColorChange = async (stageId: string, color: string) => {
    await onUpdateStage(stageId, { color });
    setColorPickerId(null);
  };

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (idx !== dragIndex) setDragOverIndex(idx);
  };
  const handleDrop = (dropIdx: number) => async (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...sortedStages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIdx, 0, moved);
    const withPositions = reordered.map((s, i) => ({ ...s, position: i + 1 }));
    setDragIndex(null);
    setDragOverIndex(null);
    setSaving(true);
    await onReorderStages(withPositions);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteStageData) return;
    const count = dealCountFor(deleteStageData.id);
    if (count > 0 && !deleteTargetId) return;
    setSaving(true);
    await onDeleteStage(deleteStageData.id, deleteTargetId || null);
    setDeleteStageData(null);
    setDeleteTargetId('');
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manage Pipeline Stages</h2>
            <p className="text-sm text-gray-500 mt-0.5">{stages.length} stages · {deals.length} deals total</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stage List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" style={{ minHeight: 0 }}>
          {sortedStages.map((stage, idx) => {
            const count = dealCountFor(stage.id);
            const isEditing = editingId === stage.id;

            return (
              <div
                key={stage.id}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  dragIndex === idx ? 'opacity-40 scale-95' : ''
                } ${dragOverIndex === idx ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-gray-50'}`}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={handleDrop(idx)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
              >
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition flex-shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>

                {/* Color dot */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setColorPickerId(colorPickerId === stage.id ? null : stage.id)}
                    className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: stage.color }}
                    title="Change colour"
                  />
                  {colorPickerId === stage.id && (
                    <div className="absolute left-0 top-7 z-50 bg-white rounded-xl shadow-xl border p-2.5">
                      <div className="grid grid-cols-6 gap-1.5">
                        {STAGE_COLORS.map(c => (
                          <button
                            key={c.hex}
                            onClick={() => handleColorChange(stage.id, c.hex)}
                            className="w-7 h-7 rounded-lg transition hover:scale-110 flex items-center justify-center"
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          >
                            {stage.color === c.hex && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stage name — click to edit */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      ref={editNameRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(stage.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(stage.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      maxLength={30}
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(stage.id); setEditName(stage.name); }}
                      className="text-sm text-gray-800 hover:text-gray-900 font-medium text-left truncate w-full flex items-center gap-1.5"
                    >
                      {stage.name}
                      <svg className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Deal count */}
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color + '18', color: stage.color }}
                >
                  {count} deal{count !== 1 ? 's' : ''}
                </span>

                {/* Delete */}
                <button
                  onClick={() => { setDeleteStageData(stage); setDeleteTargetId(''); }}
                  className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Delete stage"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}

          {/* Add New Stage */}
          {addingNew ? (
            <div className="mt-2 p-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="relative">
                  <button
                    onClick={() => setColorPickerId(colorPickerId === '_new' ? null : '_new')}
                    className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: newColor }}
                  />
                  {colorPickerId === '_new' && (
                    <div className="absolute left-0 top-7 z-50 bg-white rounded-xl shadow-xl border p-2.5">
                      <div className="grid grid-cols-6 gap-1.5">
                        {STAGE_COLORS.map(c => (
                          <button
                            key={c.hex}
                            onClick={() => { setNewColor(c.hex); setColorPickerId(null); }}
                            className="w-7 h-7 rounded-lg transition hover:scale-110 flex items-center justify-center"
                            style={{ backgroundColor: c.hex }}
                          >
                            {newColor === c.hex && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={newNameRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                  }}
                  placeholder="Stage name…"
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  maxLength={30}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddingNew(false); setNewName(''); }}
                  className="flex-1 text-xs py-1.5 bg-white border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || saving}
                  className="flex-1 text-xs py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Adding...' : 'Add Stage'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm font-medium hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Stage
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <p className="text-xs text-gray-400">Drag to reorder · Click name to rename</p>
          <button onClick={onClose} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
            Done
          </button>
        </div>

        {/* Delete Confirmation Overlay */}
        {deleteStageData && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 text-sm">Delete &ldquo;{deleteStageData.name}&rdquo;</h3>
              </div>

              {dealCountFor(deleteStageData.id) > 0 ? (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    This stage has <strong>{dealCountFor(deleteStageData.id)} deal{dealCountFor(deleteStageData.id) !== 1 ? 's' : ''}</strong>. Move them to:
                  </p>
                  <select
                    value={deleteTargetId}
                    onChange={(e) => setDeleteTargetId(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select a stage…</option>
                    {stages.filter(s => s.id !== deleteStageData.id).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({dealCountFor(s.id)} deals)</option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="text-sm text-gray-600 mb-4">This stage has no deals. Delete it?</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteStageData(null); setDeleteTargetId(''); }}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={(dealCountFor(deleteStageData.id) > 0 && !deleteTargetId) || saving}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ============================================
// SOURCES SETTINGS
// ============================================

function SourcesSettings({ sources, onSave }: { sources: string[]; onSave: (sources: string[]) => Promise<any> }) {
  const [localSources, setLocalSources] = useState(sources);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newSource, setNewSource] = useState('');

  const handleSave = async (updated: string[]) => {
    setSaving(true);
    await onSave(updated);
    setLocalSources(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addSource = () => {
    const trimmed = newSource.trim();
    if (!trimmed || localSources.includes(trimmed)) return;
    handleSave([...localSources, trimmed]);
    setNewSource('');
    setAddingNew(false);
  };

  const removeSource = (source: string) => {
    if (!confirm(`Remove "${source}" source?`)) return;
    handleSave(localSources.filter(s => s !== source));
  };

  const moveSource = (idx: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= localSources.length) return;
    const updated = [...localSources];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    handleSave(updated);
  };

  return (
    <div className="bg-white rounded-xl border p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900">Contact Sources</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customise how contacts found you</p>
        </div>
        {saved && <span className="text-xs font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">✓ Saved</span>}
      </div>

      <div className="space-y-1.5 mb-4">
        {localSources.map((source, idx) => (
          <div key={source} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg group">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveSource(idx, 'up')} className="text-gray-300 hover:text-gray-600 transition text-[10px]">▲</button>
              <button onClick={() => moveSource(idx, 'down')} className="text-gray-300 hover:text-gray-600 transition text-[10px]">▼</button>
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">{source}</span>
            <button onClick={() => removeSource(source)} className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="flex gap-2">
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addSource(); if (e.key === 'Escape') { setAddingNew(false); setNewSource(''); } }}
            autoFocus
            placeholder="Source name (e.g. Yell.com)"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button onClick={addSource} className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">Add</button>
          <button onClick={() => { setAddingNew(false); setNewSource(''); }} className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAddingNew(true)} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition">
          + Add Source
        </button>
      )}
    </div>
  );
}
// ============================================
// DAY PLAN MODAL
// ============================================

function DayPlanModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [crewCount, setCrewCount] = useState<string>(
    (deal as any).crew_count || (deal as any).quote_data?.crew_count || ''
  );
  const [vanCount, setVanCount] = useState<string>(
    (deal as any).van_count || (deal as any).quote_data?.van_count || ''
  );
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [generated, setGenerated] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/day-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: deal.id }),
      });
      const data = await res.json();
      setAiPlan(data.ai_plan);
      setGenerated(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch('/api/day-plan/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal,
          ai_plan: aiPlan,
          start_time: startTime,
          crew_count: crewCount,
          van_count: vanCount,
          special_instructions: specialInstructions,
        }),
      });
      const { html } = await res.json();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          // In print dialog, user can choose "Save as PDF"
        }, 800);
      }
    } catch (e) {
      console.error(e);
    }
    setPdfLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">🚛 Day Plan</h2>
            <p className="text-sm text-gray-500 mt-0.5">{deal.customer_name}</p>
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

          {/* Deal Notes — read only */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Deal Notes <span className="text-gray-400 font-normal normal-case">(from job record)</span>
            </label>
            <div className="w-full border border-dashed border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50 min-h-[60px]">
              {deal.notes || <span className="text-gray-400 italic">No notes on this deal</span>}
            </div>
          </div>

          {/* Special Instructions — manual */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Special Instructions <span className="text-gray-400 font-normal normal-case">(for crew — printed on plan)</span>
            </label>
            <textarea
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              rows={3}
              placeholder="Parking info, access codes, fragile items, key handover..."
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
  );
}
