'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
iimport DeleteQuoteButton from '@/components/DeleteQuoteButton';

type InstantQuote = {
  id: string;
  created_at: string;
  starting_address: string;
  ending_address: string;
  photo_urls: string[] | null;
  status: string | null;
};

export default function DashboardPage() {
  const [quotes, setQuotes] = useState<InstantQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    async function fetchQuotes() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('instant_quotes')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error:', error);
          setError(error.message);
        } else {
          setQuotes(data as InstantQuote[]);
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to load quotes');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchQuotes();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-movco-light flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-movco-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-movco-navy font-medium">Loading your quotes...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-movco-light flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-movco-navy mb-2">Error Loading Quotes</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/instant-quote"
            className="inline-flex items-center justify-center px-6 py-3 bg-movco-blue text-white font-semibold rounded-xl hover:bg-blue-600 transition-all"
          >
            Create New Quote
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-movco-light">
      {/* Header */}
      <header className="bg-movco-navy shadow-lg">
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
              <span className="text-gray-400 text-sm hidden sm:block">
                | Quote System
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/instant-quote"
                className="inline-flex items-center gap-2 px-4 py-2 bg-movco-blue text-white font-semibold rounded-lg hover:bg-blue-600 transition-all text-sm shadow-lg shadow-blue-500/25"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Quote
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/auth');
                }}
                className="text-gray-400 hover:text-white text-sm font-medium transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-movco-navy">Your Moving Quotes</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user.user_metadata?.full_name || user.email}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Quotes</p>
                <p className="text-3xl font-bold text-movco-navy mt-1">{quotes.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <svg className="w-6 h-6 text-movco-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">New</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {quotes.filter(q => q.status === 'new').length}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">With Photos</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {quotes.filter(q => q.photo_urls && q.photo_urls.length > 0).length}
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quotes List */}
        {quotes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-movco-light rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-movco-navy mb-3">No quotes yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Get started by creating your first moving quote. Our AI will analyze your photos and provide an instant estimate!
            </p>
            <Link
              href="/instant-quote"
              className="inline-flex items-center gap-2 px-8 py-4 bg-movco-blue text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:bg-blue-600 hover:shadow-blue-500/40 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Create Your First Quote
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/dashboard/${quote.id}`}
                className="block group"
              >
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-movco-blue/20 transition-all duration-200 relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-movco-navy rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-movco-navy group-hover:text-movco-blue transition-colors truncate">
                            {quote.starting_address}
                          </h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="truncate">{quote.ending_address}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(quote.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {quote.photo_urls && quote.photo_urls.length > 0 && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {quote.photo_urls.length} photo{quote.photo_urls.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          quote.status === 'new'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {quote.status || 'new'}
                        </span>
                        <DeleteQuoteButton
                          quoteId={quote.id}
                          onDeleted={() => {
                            setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
                          }}
                        />
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-movco-blue group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
