'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

// ⚠️ CHANGE THIS to your Supabase user ID to lock down admin access
const ADMIN_USER_IDS = [
  '22ca2427-69da-4272-a259-aa8fb780e6b4'
];

type AdminQuote = {
  id: string;
  created_at: string;
  starting_address: string;
  ending_address: string;
  photo_urls: string[] | null;
  status: string | null;
  user_id: string;
  interested_in_booking: boolean | null;
  estimate?: number;
  total_volume_m3?: number;
  van_count?: number;
  recommended_movers?: number;
  distance_miles?: number;
};

type DailyCount = {
  date: string;
  count: number;
};

export default function AdminDashboardPage() {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // Auth + admin check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
    // If ADMIN_USER_IDS is set, enforce it
    if (!authLoading && user && ADMIN_USER_IDS.length > 0 && !ADMIN_USER_IDS.includes(user.id)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Fetch ALL quotes (not filtered by user_id)
  useEffect(() => {
    async function fetchAllQuotes() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('instant_quotes')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          setError(error.message);
        } else {
          setQuotes(data as AdminQuote[]);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to load quotes');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchAllQuotes();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-white font-medium">Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl p-8 max-w-md w-full text-center border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ---- Calculate Metrics ----
  const totalQuotes = quotes.length;
  const interestedInBooking = quotes.filter(q => q.interested_in_booking === true).length;
  const notInterested = quotes.filter(q => q.interested_in_booking === false).length;
  const pendingResponse = quotes.filter(q => q.interested_in_booking === null || q.interested_in_booking === undefined).length;
  const withPhotos = quotes.filter(q => q.photo_urls && q.photo_urls.length > 0).length;
  const totalPhotos = quotes.reduce((sum, q) => sum + (q.photo_urls?.length || 0), 0);

  // Unique users
  const uniqueUsers = new Set(quotes.map(q => q.user_id)).size;

  // Quotes per day (last 14 days)
  const dailyCounts: DailyCount[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const count = quotes.filter(q => q.created_at.startsWith(dateStr)).length;
    dailyCounts.push({
      date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      count,
    });
  }
  const maxDailyCount = Math.max(...dailyCounts.map(d => d.count), 1);

  // Quotes this week vs last week
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const thisWeek = quotes.filter(q => new Date(q.created_at) >= oneWeekAgo).length;
  const lastWeek = quotes.filter(q => {
    const d = new Date(q.created_at);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  }).length;
  const weekChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/movco-logo.png"
                alt="MOVCO"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-white font-bold text-lg tracking-wide">
                MOVCO
              </span>
              <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                ADMIN
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-slate-400 hover:text-white text-sm font-medium transition"
              >
                User Dashboard
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/auth');
                }}
                className="text-slate-400 hover:text-white text-sm font-medium transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Overview of all quotes and booking activity
          </p>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Quotes */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Quotes</p>
            <p className="text-3xl font-bold text-white mt-2">{totalQuotes}</p>
            <p className="text-xs text-slate-500 mt-1">
              {thisWeek} this week
              {weekChange !== 0 && (
                <span className={weekChange > 0 ? ' text-green-400' : ' text-red-400'}>
                  {' '}({weekChange > 0 ? '+' : ''}{weekChange}%)
                </span>
              )}
            </p>
          </div>

          {/* Unique Users */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Unique Users</p>
            <p className="text-3xl font-bold text-white mt-2">{uniqueUsers}</p>
            <p className="text-xs text-slate-500 mt-1">{totalPhotos} photos uploaded</p>
          </div>

          {/* Booking Interest */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Want Booking</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{interestedInBooking}</p>
            <p className="text-xs text-slate-500 mt-1">
              {notInterested} declined · {pendingResponse} pending
            </p>
          </div>

          {/* Conversion Rate */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Conversion Rate</p>
            <p className="text-3xl font-bold text-amber-400 mt-2">
              {totalQuotes > 0 ? Math.round((interestedInBooking / totalQuotes) * 100) : 0}%
            </p>
            <p className="text-xs text-slate-500 mt-1">interested / total quotes</p>
          </div>
        </div>

        {/* Chart: Quotes Over Time */}
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 mb-8">
          <h2 className="text-sm font-semibold text-white mb-4">Quotes — Last 14 Days</h2>
          <div className="flex items-end gap-1.5 h-40">
            {dailyCounts.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500 font-medium">
                  {day.count > 0 ? day.count : ''}
                </span>
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${Math.max((day.count / maxDailyCount) * 100, day.count > 0 ? 8 : 2)}%`,
                    backgroundColor: day.count > 0 ? '#3b82f6' : '#1e293b',
                    minHeight: day.count > 0 ? '8px' : '2px',
                  }}
                />
                <span className="text-[9px] text-slate-600 whitespace-nowrap">
                  {day.date.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-600">{dailyCounts[0]?.date}</span>
            <span className="text-[10px] text-slate-600">{dailyCounts[dailyCounts.length - 1]?.date}</span>
          </div>
        </div>

        {/* Booking Interest Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
              <p className="text-sm font-medium text-white">Interested in Booking</p>
            </div>
            <p className="text-2xl font-bold text-green-400">{interestedInBooking}</p>
            <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-400 h-full rounded-full transition-all"
                style={{ width: `${totalQuotes > 0 ? (interestedInBooking / totalQuotes) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <p className="text-sm font-medium text-white">Declined</p>
            </div>
            <p className="text-2xl font-bold text-red-400">{notInterested}</p>
            <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-red-400 h-full rounded-full transition-all"
                style={{ width: `${totalQuotes > 0 ? (notInterested / totalQuotes) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-slate-500"></div>
              <p className="text-sm font-medium text-white">No Response Yet</p>
            </div>
            <p className="text-2xl font-bold text-slate-400">{pendingResponse}</p>
            <div className="mt-3 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-slate-500 h-full rounded-full transition-all"
                style={{ width: `${totalQuotes > 0 ? (pendingResponse / totalQuotes) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* All Quotes Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">All Quotes ({totalQuotes})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">From → To</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Photos</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Booking</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(quote.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      <br />
                      <span className="text-slate-600">
                        {new Date(quote.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-white font-medium truncate max-w-[200px]">
                        {quote.starting_address}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        → {quote.ending_address}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs text-slate-400">
                        {quote.photo_urls?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        quote.status === 'new'
                          ? 'bg-green-500/20 text-green-400'
                          : quote.status === 'booked'
                          ? 'bg-blue-500/20 text-blue-400'
                          : quote.status === 'completed'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {quote.status || 'new'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {quote.interested_in_booking === true && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400">
                          Interested
                        </span>
                      )}
                      {quote.interested_in_booking === false && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-400">
                          Declined
                        </span>
                      )}
                      {(quote.interested_in_booking === null || quote.interested_in_booking === undefined) && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700 text-slate-500">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/${quote.id}`}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {quotes.length === 0 && (
            <div className="px-6 py-12 text-center">
              <p className="text-slate-500">No quotes yet</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

