'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

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

type AiItem = {
  name?: string;
  item?: string;       // fallback field name
  quantity: number;
  note?: string;       // actual field: "~25 ft³"
  notes?: string;      // alternate field name
  volume_m3?: number;  // alternate numeric volume
};

type AiAnalysis = {
  estimated_cost?: number;
  total_volume_m3?: number;
  vans_needed?: number;
  movers_recommended?: number;
  distance_miles?: number;
  items?: AiItem[];
  // Fallback fields
  fallback?: boolean;
  message?: string;
};

export default function LeadDetailPage() {
  const [lead, setLead] = useState<Lead | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/for-companies');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && leadId) loadLeadDetail();
  }, [user, leadId]);

  const loadLeadDetail = async () => {
    if (!user) return;

    try {
      // First verify this company owns this lead
      const { data: comp } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!comp) {
        router.push('/for-companies');
        return;
      }

      // Fetch the lead
      const { data: leadData, error: leadError } = await supabase
        .from('lead_purchases')
        .select('*')
        .eq('id', leadId)
        .eq('company_id', comp.id)
        .single();

      if (leadError || !leadData) {
        setError('Lead not found or you do not have access to this lead.');
        setLoading(false);
        return;
      }

      setLead(leadData as Lead);

      // Fetch the linked quote for AI analysis details
      if (leadData.quote_id) {
        const { data: quoteData } = await supabase
          .from('instant_quotes')
          .select('ai_analysis, starting_address, ending_address')
          .eq('id', leadData.quote_id)
          .single();

        if (quoteData?.ai_analysis) {
          setAiAnalysis(quoteData.ai_analysis as AiAnalysis);
        }
      }
    } catch (err) {
      console.error('Error loading lead:', err);
      setError('Failed to load lead details.');
    }

    setLoading(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!lead) return;
    setStatusUpdating(true);

    const { error } = await supabase
      .from('lead_purchases')
      .update({ status: newStatus })
      .eq('id', lead.id);

    if (!error) {
      setLead(prev => prev ? { ...prev, status: newStatus } : prev);
    }
    setStatusUpdating(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-white font-medium">Loading lead details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link href="/company-dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition text-sm font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    won: 'bg-green-500/20 text-green-400 border-green-500/30',
    lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const items = aiAnalysis?.items || [];
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Parse numeric volume from note field (e.g. "~25 ft³") or use volume_m3
  const parseVolumeNum = (item: AiItem): number => {
    if (item.volume_m3) return item.volume_m3 * (item.quantity || 1);
    const noteStr = item.note || item.notes || '';
    const match = noteStr.match(/([\d.]+)\s*ft/i);
    if (match) return parseFloat(match[1]) * (item.quantity || 1);
    return 0;
  };

  const parseVolumeLabel = (item: AiItem): string => {
    if (item.volume_m3) return `${item.volume_m3} m³`;
    if (item.note) return item.note;
    if (item.notes) return item.notes;
    return '—';
  };

  // Calculate totals from inventory
  const totalVolumeFt3 = items.reduce((sum, item) => sum + parseVolumeNum(item), 0);
  const totalVolumeM3 = Math.round(totalVolumeFt3 * 0.0283168 * 10) / 10; // ft³ to m³

  // Estimate vans: ~350 ft³ per transit van, round up
  const estimatedVans = totalVolumeFt3 > 0 ? Math.ceil(totalVolumeFt3 / 350) : null;
  // Estimate movers: 2 for 1 van, 3 for 2+ vans
  const estimatedMovers = estimatedVans ? (estimatedVans >= 2 ? 3 : 2) : null;

  // Use lead data first, fall back to AI analysis, then calculated values
  const displayVolume = lead.volume || (aiAnalysis?.total_volume_m3 ? `${aiAnalysis.total_volume_m3} m³` : (totalVolumeM3 > 0 ? `${totalVolumeM3} m³` : '—'));
  const displayVans = lead.vans || (aiAnalysis?.vans_needed ? `${aiAnalysis.vans_needed}` : (estimatedVans ? `${estimatedVans}` : '—'));
  const displayMovers = lead.movers || (aiAnalysis?.movers_recommended ? `${aiAnalysis.movers_recommended}` : (estimatedMovers ? `${estimatedMovers}` : '—'));

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/company-dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Image src="/movco-logo.png" alt="MOVCO" width={28} height={28} className="rounded-lg" />
              <span className="text-white font-bold text-sm tracking-wide">MOVCO</span>
              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full">COMPANY</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title + status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Lead Details</h1>
            <p className="text-slate-500 text-sm mt-1">
              Received {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}Lead cost: £{(lead.amount_charged_pence / 100).toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={lead.status}
              onChange={e => updateStatus(e.target.value)}
              disabled={statusUpdating}
              className={`text-sm font-semibold rounded-lg px-4 py-2 border cursor-pointer transition
                ${statusColors[lead.status] || 'bg-slate-800 text-white border-slate-700'}
                disabled:opacity-50`}
            >
              <option value="new">🔵 New</option>
              <option value="contacted">🟡 Contacted</option>
              <option value="won">🟢 Won</option>
              <option value="lost">🔴 Lost</option>
            </select>
          </div>
        </div>

        {/* Customer + Move Details - two column */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Customer Contact */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Customer</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Full Name</p>
                <p className="text-white font-medium">{lead.customer_name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Email</p>
                {lead.customer_email ? (
                  <a href={`mailto:${lead.customer_email}`} className="text-blue-400 hover:text-blue-300 transition font-medium">
                    {lead.customer_email}
                  </a>
                ) : (
                  <p className="text-slate-400">Not provided</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                {lead.customer_phone ? (
                  <a href={`tel:${lead.customer_phone}`} className="text-blue-400 hover:text-blue-300 transition font-medium text-lg">
                    {lead.customer_phone}
                  </a>
                ) : (
                  <p className="text-slate-400">Not provided</p>
                )}
              </div>
            </div>
          </div>

          {/* Move Details */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Move Details</h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Moving From</p>
                <p className="text-white font-medium">{lead.from_postcode || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Moving To</p>
                <p className="text-white font-medium">{lead.to_postcode || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Distance</p>
                <p className="text-white font-medium">{lead.distance || 'Not calculated'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Estimate Summary */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">AI Estimate</h2>
          </div>

          {/* Big quote number */}
          <div className="text-center mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Customer&apos;s AI Quote</p>
            <p className="text-4xl font-bold text-white">
              {lead.estimated_quote || (aiAnalysis?.estimated_cost ? `£${aiAnalysis.estimated_cost.toLocaleString()}` : '—')}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {displayVolume}
              </p>
              <p className="text-xs text-slate-500 mt-1">Volume</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {displayVans}
              </p>
              <p className="text-xs text-slate-500 mt-1">Vans Needed</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {displayMovers}
              </p>
              <p className="text-xs text-slate-500 mt-1">Movers</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {lead.distance || (aiAnalysis?.distance_miles ? `${aiAnalysis.distance_miles} mi` : '—')}
              </p>
              <p className="text-xs text-slate-500 mt-1">Distance</p>
            </div>
          </div>

          {(estimatedVans || estimatedMovers) && !lead.volume && !aiAnalysis?.total_volume_m3 && (
            <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs text-blue-400">
                ℹ️ Volume, vans, and movers are estimated from the AI-detected inventory.
              </p>
            </div>
          )}

          {aiAnalysis?.fallback && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                ⚠️ This is a fallback estimate. AI photo analysis was not available for this quote.
              </p>
            </div>
          )}
        </div>

        {/* AI-Detected Inventory */}
        {items.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-6">
            <div className="p-6 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">AI-Detected Inventory</h2>
              </div>
              <p className="text-xs text-slate-500 ml-10">
                {totalItems} item{totalItems !== 1 ? 's' : ''} detected{totalVolumeM3 > 0 ? ` · ~${totalVolumeM3} m³ total volume` : ''}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b border-slate-800">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Est. Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-3 text-white font-medium">{item.name || item.item || 'Unknown item'}</td>
                      <td className="px-6 py-3 text-center text-slate-300">{item.quantity}</td>
                      <td className="px-6 py-3 text-center text-slate-400 text-xs">{parseVolumeLabel(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-800 flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Total</span>
              <span className="text-white font-bold">{totalItems} items{totalVolumeM3 > 0 ? ` · ~${totalVolumeM3} m³` : ''}</span>
            </div>
          </div>
        )}

        {/* No inventory message */}
        {items.length === 0 && !loading && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 mb-6 text-center">
            <div className="text-3xl mb-2">📦</div>
            <p className="text-white font-medium mb-1">No Detailed Inventory Available</p>
            <p className="text-slate-500 text-sm">
              The AI inventory breakdown is not available for this quote. Use the summary estimates above.
            </p>
          </div>
        )}

        {/* Quick action buttons */}
        <div className="flex flex-wrap gap-3 mb-8">
          {lead.customer_phone && (
            <a href={`tel:${lead.customer_phone}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 transition font-semibold text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call Customer
            </a>
          )}
          {lead.customer_email && (
            <a href={`mailto:${lead.customer_email}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition font-semibold text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Customer
            </a>
          )}
          <Link href="/company-dashboard"
            className="inline-flex items-center gap-2 px-5 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition font-semibold text-sm border border-slate-700">
            ← Back to All Leads
          </Link>
        </div>
      </main>
    </div>
  );
}
