'use client';

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

const UK_POSTCODE_AREAS = [
  'AB','AL','B','BA','BB','BD','BH','BL','BN','BR','BS','BT',
  'CA','CB','CF','CH','CM','CO','CR','CT','CV','CW',
  'DA','DD','DE','DG','DH','DL','DN','DT','DY',
  'E','EC','EH','EN','EX',
  'FK','FY',
  'G','GL','GU',
  'HA','HD','HG','HP','HR','HS','HU','HX',
  'IG','IP','IV',
  'KA','KT','KW','KY',
  'L','LA','LD','LE','LL','LN','LS','LU',
  'M','ME','MK','ML',
  'N','NE','NG','NN','NP','NR','NW',
  'OL','OX',
  'PA','PE','PH','PL','PO','PR',
  'RG','RH','RM',
  'S','SA','SE','SG','SK','SL','SM','SN','SO','SP','SR','SS','ST','SW','SY',
  'TA','TD','TF','TN','TQ','TR','TS','TW',
  'UB',
  'W','WA','WC','WD','WF','WN','WR','WS','WV',
  'YO',
  'ZE'
];

type Company = {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string | null;
  postcode: string | null;
  coverage_postcodes: string[];
  balance_pence: number;
  stripe_customer_id: string | null;
  is_active: boolean;
  created_at: string;
};

type Lead = {
  id: string;
  company_id: string;
  quote_id: string;
  amount_charged_pence: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  from_postcode: string | null;
  to_postcode: string | null;
  distance: string | null;
  estimated_quote: string | null;
  volume: string | null;
  vans: string | null;
  movers: string | null;
  status: string;
  created_at: string;
};

type Transaction = {
  id: string;
  company_id: string;
  amount_pence: number;
  type: string;
  description: string | null;
  created_at: string;
};

function CompanyDashboardContent() {
  const [company, setCompany] = useState<Company | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'leads' | 'transactions' | 'settings'>('leads');
  const [loading, setLoading] = useState(true);
  const [topUpLoading, setTopUpLoading] = useState<number | null>(null);
  const [savingCoverage, setSavingCoverage] = useState(false);
  const [editCoverage, setEditCoverage] = useState<string[]>([]);
  const [showTopUpSuccess, setShowTopUpSuccess] = useState(false);

  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for Stripe success/cancel
  useEffect(() => {
    if (searchParams.get('topup') === 'success') {
      setShowTopUpSuccess(true);
      setTimeout(() => setShowTopUpSuccess(false), 5000);
      // Refresh data after successful top-up
      setTimeout(() => loadDashboard(), 2000);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/for-companies');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    if (!user) return;

    // Get company record
    const { data: comp, error: compError } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (compError || !comp) {
      // Not a company user - redirect to sign up
      router.push('/for-companies');
      return;
    }

    setCompany(comp as Company);
    setEditCoverage(comp.coverage_postcodes || []);

    // Get leads
    const { data: leadData } = await supabase
      .from('lead_purchases')
      .select('*')
      .eq('company_id', comp.id)
      .order('created_at', { ascending: false });
    setLeads((leadData || []) as Lead[]);

    // Get transactions
    const { data: txData } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('company_id', comp.id)
      .order('created_at', { ascending: false });
    setTransactions((txData || []) as Transaction[]);

    setLoading(false);
  };

  const handleTopUp = async (amountPence: number) => {
    if (!company) return;
    setTopUpLoading(amountPence);

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          amount_pence: amountPence,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Top-up error:', err);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setTopUpLoading(null);
    }
  };

  const updateLeadStatus = async (leadId: string, status: string) => {
    await supabase
      .from('lead_purchases')
      .update({ status })
      .eq('id', leadId);

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
  };

  const toggleCoveragePostcode = (pc: string) => {
    setEditCoverage(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc]
    );
  };

  const saveCoverage = async () => {
    if (!company) return;
    setSavingCoverage(true);

    const { error } = await supabase
      .from('companies')
      .update({ coverage_postcodes: editCoverage })
      .eq('id', company.id);

    if (!error) {
      setCompany(prev => prev ? { ...prev, coverage_postcodes: editCoverage } : prev);
    }
    setSavingCoverage(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-white font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!user || !company) return null;

  const newLeads = leads.filter(l => l.status === 'new').length;
  const wonLeads = leads.filter(l => l.status === 'won').length;
  const totalSpent = leads.reduce((sum, l) => sum + l.amount_charged_pence, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top-up success banner */}
      {showTopUpSuccess && (
        <div className="bg-green-500 text-white text-center py-3 text-sm font-medium animate-pulse">
          ✅ Payment successful! Your balance will be updated shortly.
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image src="/movco-logo.png" alt="MOVCO" width={36} height={36} className="rounded-lg" />
              <span className="text-white font-bold text-lg tracking-wide">MOVCO</span>
              <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-0.5 rounded-full">COMPANY</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Balance badge */}
              <div className="bg-slate-800 rounded-lg px-4 py-1.5 flex items-center gap-2">
                <span className="text-xs text-slate-400">Balance</span>
                <span className="text-lg font-bold text-green-400">£{(company.balance_pence / 100).toFixed(2)}</span>
              </div>
              <button onClick={async () => { await signOut(); router.push('/for-companies'); }}
                className="text-slate-400 hover:text-white text-sm font-medium transition">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{company.company_name}</h1>
          <p className="text-slate-400 mt-1">Manage your leads, balance, and coverage areas</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Balance</p>
            <p className="text-2xl font-bold text-green-400 mt-2">£{(company.balance_pence / 100).toFixed(2)}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Leads</p>
            <p className="text-2xl font-bold text-white mt-2">{leads.length}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">New Leads</p>
            <p className="text-2xl font-bold text-blue-400 mt-2">{newLeads}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Won</p>
            <p className="text-2xl font-bold text-green-400 mt-2">{wonLeads}</p>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Coverage</p>
            <p className="text-2xl font-bold text-amber-400 mt-2">{company.coverage_postcodes?.length || 0}</p>
            <p className="text-xs text-slate-500 mt-1">postcode areas</p>
          </div>
        </div>

        {/* Top-up section */}
        <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Top Up Balance</h3>
              <p className="text-xs text-slate-500 mt-0.5">Add funds to receive more leads. Each lead costs £5.00.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total spent</p>
              <p className="text-sm font-bold text-slate-300">£{(totalSpent / 100).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { amount: 2500, label: '£25', leads: '5 leads' },
              { amount: 5000, label: '£50', leads: '10 leads' },
              { amount: 10000, label: '£100', leads: '20 leads' },
              { amount: 25000, label: '£250', leads: '50 leads' },
            ].map(({ amount, label, leads: leadCount }) => (
              <button key={amount} onClick={() => handleTopUp(amount)}
                disabled={topUpLoading !== null}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all border
                  ${topUpLoading === amount
                    ? 'bg-green-600 text-white border-green-500'
                    : 'bg-slate-800 text-white border-slate-700 hover:bg-green-600 hover:border-green-500'
                  } disabled:opacity-50`}>
                {topUpLoading === amount ? (
                  <svg className="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>
                    <span className="text-lg">{label}</span>
                    <span className="block text-xs opacity-70 mt-0.5">~{leadCount}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-lg p-1 w-fit border border-slate-800">
          {(['leads', 'transactions', 'settings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition capitalize
                ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              {tab === 'leads' ? `📋 Leads (${leads.length})` : tab === 'transactions' ? '💳 Transactions' : '⚙️ Settings'}
            </button>
          ))}
        </div>

        {/* ========== LEADS TAB ========== */}
        {activeTab === 'leads' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Move</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Details</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Quote</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-white font-medium">{lead.customer_name || 'N/A'}</p>
                        <p className="text-xs text-slate-500">{lead.customer_email || ''}</p>
                        {lead.customer_phone && (
                          <p className="text-xs text-blue-400 font-medium mt-0.5">{lead.customer_phone}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-white truncate max-w-[160px]">{lead.from_postcode || '—'}</p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[160px]">→ {lead.to_postcode || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {lead.distance && <p>{lead.distance}</p>}
                        {lead.vans && <p>{lead.vans}</p>}
                        {lead.movers && <p>{lead.movers} movers</p>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-sm font-bold text-white">{lead.estimated_quote || '—'}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <select value={lead.status} onChange={e => updateLeadStatus(lead.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-3 py-1 border-0 cursor-pointer
                            ${lead.status === 'new' ? 'bg-blue-500/20 text-blue-400'
                              : lead.status === 'contacted' ? 'bg-amber-500/20 text-amber-400'
                              : lead.status === 'won' ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'}`}>
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="won">Won</option>
                          <option value="lost">Lost</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-slate-400">
                        £{(lead.amount_charged_pence / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leads.length === 0 && (
              <div className="px-6 py-16 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="text-white font-semibold mb-1">No leads yet</p>
                <p className="text-slate-500 text-sm">
                  Make sure you have balance and coverage areas set up. Leads will appear here automatically when customers in your area express interest.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========== TRANSACTIONS TAB ========== */}
        {activeTab === 'transactions' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-800/50">
                      <td className="px-5 py-4 text-xs text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold
                          ${tx.type === 'top_up' ? 'bg-green-500/20 text-green-400'
                            : tx.type === 'refund' ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-red-500/20 text-red-400'}`}>
                          {tx.type === 'top_up' ? 'Top Up' : tx.type === 'refund' ? 'Refund' : 'Lead Purchase'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300">{tx.description || '—'}</td>
                      <td className={`px-5 py-4 text-right text-sm font-bold
                        ${tx.amount_pence > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount_pence > 0 ? '+' : ''}£{(tx.amount_pence / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.length === 0 && (
              <div className="px-6 py-16 text-center">
                <p className="text-slate-500 text-sm">No transactions yet. Top up your balance to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* ========== SETTINGS TAB ========== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Company info */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Company Info</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Company Name</p>
                  <p className="text-white font-medium">{company.company_name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Contact</p>
                  <p className="text-white font-medium">{company.contact_name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Email</p>
                  <p className="text-white">{company.email}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Phone</p>
                  <p className="text-white">{company.phone}</p>
                </div>
              </div>
            </div>

            {/* Coverage area editor */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Coverage Areas</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select postcode prefixes you cover. You&apos;ll receive leads from these areas.
                    Currently: <span className="text-blue-400 font-semibold">{editCoverage.length}</span> areas selected.
                  </p>
                </div>
                <button onClick={saveCoverage} disabled={savingCoverage}
                  className="px-4 py-2 bg-movco-blue text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition disabled:opacity-50">
                  {savingCoverage ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              {/* Selected preview */}
              {editCoverage.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4 p-3 bg-slate-800 rounded-lg">
                  {editCoverage.sort().map(pc => (
                    <span key={pc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs font-mono rounded">
                      {pc}
                      <button onClick={() => toggleCoveragePostcode(pc)} className="hover:text-red-300 text-[10px]">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-48 overflow-y-auto">
                {UK_POSTCODE_AREAS.map(pc => (
                  <button key={pc} onClick={() => toggleCoveragePostcode(pc)}
                    className={`py-1.5 text-xs rounded border font-mono font-semibold transition-all
                      ${editCoverage.includes(pc)
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-blue-400 hover:text-blue-400'}`}>
                    {pc}
                  </button>
                ))}
              </div>
            </div>

            {/* Account status */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Account Status</h3>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${company.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm text-slate-300">{company.is_active ? 'Active — receiving leads' : 'Paused — not receiving leads'}</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CompanyDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><span className="text-white">Loading...</span></div>}>
      <CompanyDashboardContent />
    </Suspense>
  );
}
