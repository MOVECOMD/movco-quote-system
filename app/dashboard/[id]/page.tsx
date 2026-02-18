'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import BookingModal from "@/components/BookingModal";

type InstantQuote = {
  id: string | null;
  created_at: string;
  starting_address: string;
  ending_address: string;
  photo_urls: string[] | null;
  status: string | null;
};

type AiItem = {
  name: string;
  quantity: number;
  note?: string;
};

type AiAnalysis = {
  estimate: number;
  description: string;
  items: AiItem[];
  totalVolumeM3: number;
  totalAreaM2: number;
  distance_miles?: number;
  duration_text?: string;
  van_count?: number;
  van_description?: string;
  recommended_movers?: number;
  is_weekend?: boolean;
  pricing_method?: string;
};

async function generateAnalysis(quote: InstantQuote): Promise<AiAnalysis> {
  if (!quote.photo_urls || quote.photo_urls.length === 0) {
    return {
      estimate: 1200,
      description: "No photos provided. Upload photos for AI-powered furniture detection and accurate pricing.",
      items: [
        { name: "Estimated contents", quantity: 1, note: "Upload photos for detailed analysis" }
      ],
      totalVolumeM3: 20,
      totalAreaM2: 26,
    };
  }

  try {
    console.log('Calling AI analysis API with', quote.photo_urls.length, 'photos...');

    const response = await fetch('https://movco-api.onrender.com/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        starting_address: quote.starting_address,
        ending_address: quote.ending_address,
        photo_urls: quote.photo_urls,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      throw new Error(`Analysis failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI analysis complete:', data);

    return {
      estimate: data.estimate,
      description: data.description,
      items: data.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        note: item.estimated_volume_ft3
          ? `~${item.estimated_volume_ft3} ft³`
          : item.note,
      })),
      totalVolumeM3: data.totalVolumeM3,
      totalAreaM2: data.totalAreaM2,
      distance_miles: data.distance_miles,
      duration_text: data.duration_text,
      van_count: data.van_count,
      van_description: data.van_description,
      recommended_movers: data.recommended_movers,
      is_weekend: data.is_weekend,
      pricing_method: data.pricing_method,
    };
  } catch (error) {
    console.error('AI Analysis error:', error);

    const photoCount = quote.photo_urls?.length ?? 0;
    const base = 1200;
    const perPhoto = 150;
    const estimate = base + perPhoto * Math.max(1, photoCount);

    return {
      estimate,
      description: "AI analysis temporarily unavailable. Showing estimated values based on number of photos. Please try refreshing the page.",
      items: [
        { name: "Estimated furniture & contents", quantity: photoCount * 10, note: "AI analysis failed - using fallback estimate" }
      ],
      totalVolumeM3: Math.round(estimate / 55),
      totalAreaM2: Math.round((estimate / 55) * 1.3),
    };
  }
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [quote, setQuote] = useState<InstantQuote | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchQuote() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("instant_quotes")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Supabase error:", error);
          setError(error.message);
        } else if (!data) {
          setError("Quote not found");
        } else {
          setQuote(data as InstantQuote);

          setAnalyzing(true);
          try {
            const aiAnalysis = await generateAnalysis(data as InstantQuote);
            setAnalysis(aiAnalysis);

            // Show booking modal after analysis completes
            // Only show if user hasn't already responded
            if (data.interested_in_booking === null || data.interested_in_booking === undefined) {
              setShowBookingModal(true);
            }
          } catch (err) {
            console.error("Analysis error:", err);
            setAnalysis({
              estimate: 1200,
              description: "Analysis failed. Please try again.",
              items: [],
              totalVolumeM3: 20,
              totalAreaM2: 26,
            });
          } finally {
            setAnalyzing(false);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    if (id && user) {
      fetchQuote();
    } else if (!id) {
      setError("No ID provided in URL");
      setLoading(false);
    }
  }, [id, user]);

  if (authLoading) return null;
  if (!user) return null;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-700 font-medium">Loading quote…</p>
        </div>
      </main>
    );
  }

  if (error || !quote) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Quote not found</h1>
          <p className="text-sm text-slate-700">We couldn&apos;t load this quote.</p>
          <div className="text-xs text-slate-600 space-y-1">
            <p><span className="font-semibold">Requested ID:</span> {id}</p>
            {error && <p><span className="font-semibold">Error:</span> {error}</p>}
          </div>
          <Link href="/dashboard" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (analyzing || !analysis) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-xl mb-6">
            <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-900 font-bold text-2xl mb-2">Analyzing Your Photos</p>
          <p className="text-slate-700 text-lg mb-4">Claude Vision AI is detecting furniture...</p>
          <div className="max-w-md mx-auto">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <p className="text-sm text-slate-600">
                Our AI is examining {quote.photo_urls?.length || 0} photo(s) to identify furniture,
                calculate volumes, and generate your accurate quote.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const {
    estimate,
    description,
    items,
    totalVolumeM3,
    totalAreaM2,
    distance_miles,
    duration_text,
    van_count,
    van_description,
    recommended_movers,
    is_weekend,
    pricing_method,
  } = analysis;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Booking Modal */}
      {showBookingModal && quote.id && (
        <BookingModal
          quoteId={quote.id}
          quoteData={{
            starting_address: quote.starting_address,
            ending_address: quote.ending_address,
            estimate,
            volume_m3: totalVolumeM3,
            van_count,
            van_description,
            recommended_movers,
            distance_miles,
          }}
          onClose={() => setShowBookingModal(false)}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900">Quote Details</h1>
            <p className="text-sm text-slate-700 font-medium">
              Created {new Date(quote.created_at).toLocaleString()}
            </p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors">
            ← Back to dashboard
          </Link>
        </header>

        {/* Addresses */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Addresses</h2>
              <p className="text-sm text-slate-800 mb-1">
                <span className="font-semibold">From:</span> {quote.starting_address}
              </p>
              <p className="text-sm text-slate-800">
                <span className="font-semibold">To:</span> {quote.ending_address}
              </p>
              {distance_miles && (
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-semibold">Distance:</span> {distance_miles} miles
                  {duration_text && ` (${duration_text})`}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex rounded-full bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-800">
                Status: {quote.status ?? "new"}
              </span>
              {is_weekend && (
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Weekend Rate
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Price Estimate — Hero Card */}
        <section className="bg-white rounded-2xl shadow-lg p-6 border border-white/20">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            AI Estimate
          </h2>

          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-5xl font-bold text-green-700">
              £{estimate.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </p>
            {pricing_method && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {pricing_method === 'model' ? 'AI Model' : pricing_method === 'hybrid' ? 'Hybrid' : 'Calculated'}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-700 leading-relaxed mb-6">{description}</p>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg mb-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-blue-700">{totalVolumeM3}</p>
              <p className="text-xs text-blue-600 font-medium">Volume (m³)</p>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg mb-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h2m6 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-amber-700">{van_count ?? '—'}</p>
              <p className="text-xs text-amber-600 font-medium">
                {van_count === 1 ? 'Van' : 'Vans'} Needed
              </p>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg mb-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-purple-700">{recommended_movers ?? '—'}</p>
              <p className="text-xs text-purple-600 font-medium">Movers</p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {distance_miles ? `${distance_miles}` : '—'}
              </p>
              <p className="text-xs text-green-600 font-medium">Miles</p>
            </div>
          </div>

          {van_description && (
            <div className="mt-4 bg-slate-50 rounded-xl p-4 flex items-center gap-3 border border-slate-200">
              <div className="flex-shrink-0 w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h2m6 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{van_description}</p>
                <p className="text-xs text-slate-600">
                  with {recommended_movers} professional mover{recommended_movers !== 1 ? 's' : ''}
                  {duration_text && ` · ${duration_text} drive`}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* AI-Detected Inventory */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-100 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            AI-Detected Inventory
          </h2>
          <p className="text-xs text-slate-600">
            Furniture and items detected by Claude Vision AI from your {quote.photo_urls?.length ?? 0} uploaded photo(s).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-900 rounded-tl-lg">Item</th>
                  <th className="px-4 py-3 font-semibold text-slate-900 text-center">Qty</th>
                  <th className="px-4 py-3 font-semibold text-slate-900 rounded-tr-lg">Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-slate-800 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{item.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              {items.reduce((sum, i) => sum + i.quantity, 0)} total items across {items.length} categories · {totalVolumeM3} m³ total volume
            </p>
          )}
        </section>

        {/* Analyzed Photos */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 bg-sky-100 rounded-lg">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            Analyzed Photos
          </h2>
          {quote.photo_urls && quote.photo_urls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quote.photo_urls.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border-2 border-slate-200 hover:ring-4 hover:ring-blue-400/50 transition-all">
                  <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-48 object-cover" />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-700">No photos uploaded.</p>
          )}
        </section>
      </div>
    </main>
  );
}
