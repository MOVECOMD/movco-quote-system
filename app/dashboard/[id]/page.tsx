'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

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
};

// AI Analysis using real Claude Vision API
async function generateAnalysis(quote: InstantQuote): Promise<AiAnalysis> {
  // If no photos, return placeholder
  if (!quote.photo_urls || quote.photo_urls.length === 0) {
    return {
      estimate: 1200,
      description: "No photos provided. Upload photos for AI-powered furniture detection and accurate pricing.",
      items: [
        { name: "Estimated contents", quantity: 1, note: "Upload photos for detailed analysis" }
      ],
      totalVolumeM3: 20,
      totalAreaM2: 26
    };
  }

  try {
    console.log('Calling AI analysis API with', quote.photo_urls.length, 'photos...');
    
    // Call your Python backend's real AI analysis
    const response = await fetch('http://localhost:8000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        starting_address: quote.starting_address,
        ending_address: quote.ending_address,
        photo_urls: quote.photo_urls
      })
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
          : item.note
      })),
      totalVolumeM3: data.totalVolumeM3,
      totalAreaM2: data.totalAreaM2
    };
    
  } catch (error) {
    console.error('AI Analysis error:', error);
    
    // Fallback to basic estimate if API fails
    const photoCount = quote.photo_urls?.length ?? 0;
    const base = 1200;
    const perPhoto = 150;
    const estimate = base + perPhoto * Math.max(1, photoCount);
    
    return {
      estimate: estimate,
      description: "AI analysis temporarily unavailable. Showing estimated values based on number of photos. Please try refreshing the page.",
      items: [
        { name: "Estimated furniture & contents", quantity: photoCount * 10, note: "AI analysis failed - using fallback estimate" }
      ],
      totalVolumeM3: Math.round(estimate / 55),
      totalAreaM2: Math.round((estimate / 55) * 1.3)
    };
  }
}

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [quote, setQuote] = useState<InstantQuote | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuote() {
      try {
        const { data, error } = await supabase
          .from("instant_quotes")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) {
          console.error("Supabase error:", error);
          setError(error.message);
        } else if (!data) {
          setError("Quote not found");
        } else {
          setQuote(data as InstantQuote);
          
          // Generate AI analysis
          setAnalyzing(true);
          try {
            const aiAnalysis = await generateAnalysis(data as InstantQuote);
            setAnalysis(aiAnalysis);
          } catch (err) {
            console.error("Analysis error:", err);
            // Set fallback analysis
            setAnalysis({
              estimate: 1200,
              description: "Analysis failed. Please try again.",
              items: [],
              totalVolumeM3: 20,
              totalAreaM2: 26
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

    if (id) {
      fetchQuote();
    } else {
      setError("No ID provided in URL");
      setLoading(false);
    }
  }, [id]);

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
          <p className="text-sm text-slate-700">
            We couldn&apos;t load this quote.
          </p>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              <span className="font-semibold">Requested ID:</span> {id}
            </p>
            {error && (
              <p>
                <span className="font-semibold">Error:</span> {error}
              </p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  // Show analyzing state
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
          <p className="text-slate-900 font-bold text-2xl mb-2">🤖 Analyzing Your Photos</p>
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

  // Use the analysis state
  const { estimate, description, items, totalVolumeM3, totalAreaM2 } = analysis;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900">Quote Details</h1>
            <p className="text-sm text-slate-700 font-medium">
              Created {new Date(quote.created_at).toLocaleString()}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors"
          >
            ← Back to dashboard
          </Link>
        </header>

        {/* Addresses + status */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Addresses</h2>
              <p className="text-sm text-slate-800 mb-1">
                <span className="font-semibold">From:</span>{" "}
                {quote.starting_address}
              </p>
              <p className="text-sm text-slate-800">
                <span className="font-semibold">To:</span>{" "}
                {quote.ending_address}
              </p>
            </div>
            <div>
              <span className="inline-flex rounded-full bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-800">
                Status: {quote.status ?? "new"}
              </span>
            </div>
          </div>
        </section>

        {/* AI estimate + description */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <h2 className="text-lg font-semibold text-slate-900">🤖 AI Estimate</h2>
          <p className="text-4xl font-bold text-green-700">
            £{estimate.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-slate-800 leading-relaxed">
            {description}
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-slate-800 mt-4 pt-4 border-t border-slate-200">
            <div>
              <span className="font-semibold text-slate-900">Estimated volume:</span>{" "}
              {totalVolumeM3} m³
            </div>
            <div>
              <span className="font-semibold text-slate-900">Estimated area:</span>{" "}
              {totalAreaM2} m²
            </div>
          </div>
        </section>

        {/* AI itemised inventory */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <h2 className="text-lg font-semibold text-slate-900">
            ✨ AI-Detected Inventory
          </h2>
          <p className="text-xs text-slate-700 mb-3">
            Furniture and items detected by Claude Vision AI from your uploaded photos.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-900">Item</th>
                  <th className="px-4 py-3 font-semibold text-slate-900">Quantity</th>
                  <th className="px-4 py-3 font-semibold text-slate-900">Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-200">
                    <td className="px-4 py-3 text-slate-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-slate-800">{item.quantity}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {item.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white rounded-2xl shadow-lg p-6 space-y-4 border border-white/20">
          <h2 className="text-lg font-semibold text-slate-900">📸 Analyzed Photos</h2>
          {quote.photo_urls && quote.photo_urls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quote.photo_urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl overflow-hidden border-2 border-slate-200 hover:ring-4 hover:ring-blue-400/50 transition-all"
                >
                  <img
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-48 object-cover"
                  />
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