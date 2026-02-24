'use client';

import { FormEvent, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import Link from 'next/link';

const FREE_QUOTE_LIMIT = 3;

export default function InstantQuotePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [startingAddress, setStartingAddress] = useState('');
  const [endingAddress, setEndingAddress] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Quote limit state
  const [quoteCount, setQuoteCount] = useState(0);
  const [extraCredits, setExtraCredits] = useState(0);
  const [quoteLimitLoading, setQuoteLimitLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Check user's quote count and purchased credits on load
  useEffect(() => {
    async function checkQuoteLimit() {
      let uid: string | null = null;
      try {
        const storageKey = Object.keys(localStorage).find(k => k.includes('auth-token'));
        if (storageKey) {
          const tokenData = JSON.parse(localStorage.getItem(storageKey) || '{}');
          uid = tokenData?.user?.id || null;
        }
      } catch (e) {
        console.error('Error reading auth:', e);
      }

      setUserId(uid);

      if (!uid) {
        setQuoteLimitLoading(false);
        return;
      }

      // Count quotes used
      const { count, error } = await supabase
        .from('instant_quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid);

      if (!error) {
        setQuoteCount(count || 0);
      }

      // Check purchased credits
      const { data: creditData } = await supabase
        .from('user_quote_credits')
        .select('credits')
        .eq('user_id', uid)
        .maybeSingle();

      if (creditData) {
        setExtraCredits(creditData.credits || 0);
      }

      setQuoteLimitLoading(false);
    }

    checkQuoteLimit();
  }, []);

  const totalAllowed = FREE_QUOTE_LIMIT + extraCredits;
  const remainingQuotes = totalAllowed - quoteCount;

  // ACCUMULATE files from gallery (multiple selection)
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so the same files can be selected again
    e.target.value = '';
  };

  // ACCUMULATE files from camera (one at a time)
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so camera can be opened again immediately
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSuccessText(null);
    setSubmitting(true);

    try {
      // Double-check quote limit before submitting
      if (quoteCount >= totalAllowed) {
        throw new Error('You have used all your free quotes. Please purchase more to continue.');
      }

      if (!startingAddress.trim() || !endingAddress.trim()) {
        throw new Error('Please fill in both addresses.');
      }

      // GA4: Track quote started
      window.movcoTrackQuoteStarted?.();

      const uploadedUrls: string[] = [];

      for (const file of files) {
        const filePath = `${Date.now()}-${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file);

        if (uploadError || !uploadData) {
          console.error('Upload error:', uploadError);
          throw new Error(uploadError?.message || 'Failed to upload photo.');
        }

        const { data: publicData } = supabase.storage
          .from('photos')
          .getPublicUrl(uploadData.path);

        if (publicData?.publicUrl) {
          uploadedUrls.push(publicData.publicUrl);
        }
      }

      const { data: insertData, error: insertError } = await supabase
        .from('instant_quotes')
        .insert({
          starting_address: startingAddress,
          ending_address: endingAddress,
          photo_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
          status: 'new',
          user_id: userId,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error((insertError as any).message || 'Failed to save quote.');
      }

      // Update local count
      setQuoteCount(prev => prev + 1);

      // GA4: Track quote completed
      window.movcoTrackQuoteCompleted?.();

      setSuccessText('Quote submitted successfully! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err: any) {
      setErrorText(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state while checking quota
  if (quoteLimitLoading) {
    return (
      <div className="min-h-screen bg-movco-light flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-movco-blue" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-movco-navy font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  // FULL-SCREEN LOADING — analyzing photos
  if (submitting) {
    return (
      <div className="min-h-screen bg-movco-navy flex flex-col items-center justify-center">
        <Image
          src="/movco-logo.png"
          alt="MOVCO"
          width={120}
          height={120}
          className="animate-pulse rounded-2xl shadow-2xl"
        />
        <p className="text-white text-lg font-semibold mt-6">Analyzing your photos...</p>
        <p className="text-gray-400 text-sm mt-2">This usually takes 30-60 seconds</p>
      </div>
    );
  }

  // PAYWALL — user has used all free quotes
  if (quoteCount >= totalAllowed) {
    return (
      <div className="min-h-screen bg-movco-light">
        {/* Header */}
        <header className="bg-movco-navy shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/dashboard" className="flex items-center gap-3">
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
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-400 hover:text-white text-sm font-medium transition"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-16">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
            {/* Lock icon */}
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-movco-navy mb-2">
              You've Used All 3 Free Quotes
            </h2>
            <p className="text-gray-500 mb-8">
              Unlock 5 more instant AI-powered moving quotes to keep planning your move.
            </p>

            {/* Pricing card */}
            <div className="bg-gradient-to-br from-movco-navy to-blue-900 rounded-xl p-6 text-white mb-6">
              <div className="text-sm font-medium text-blue-300 mb-1">Quote Pack</div>
              <div className="flex items-baseline justify-center gap-1 mb-1">
                <span className="text-4xl font-bold">£4.99</span>
                <span className="text-blue-300 text-sm">/ 5 quotes</span>
              </div>
              <p className="text-blue-200 text-xs">That's less than £1 per quote</p>
            </div>

            {/* Benefits */}
            <div className="text-left space-y-3 mb-8">
              {[
                '5 additional AI-powered instant quotes',
                'Full photo analysis included',
                'Compare multiple moves easily',
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>

            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/stripe/create-quote-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      user_id: userId,
                      user_email: null,
                    }),
                  });
                  const data = await res.json();
                  if (data.url) {
                    window.location.href = data.url;
                  } else {
                    alert('Something went wrong. Please try again.');
                  }
                } catch (err) {
                  console.error('Checkout error:', err);
                  alert('Something went wrong. Please try again.');
                }
              }}
              className="w-full bg-movco-blue hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 text-lg"
            >
              Unlock 5 More Quotes — £4.99
            </button>

            <Link
              href="/dashboard"
              className="inline-block mt-4 text-sm text-gray-500 hover:text-movco-navy transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // NORMAL FORM — user still has free quotes
  return (
    <div className="min-h-screen bg-movco-light">
      {/* Header */}
      <header className="bg-movco-navy shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center gap-3">
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
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-400 hover:text-white text-sm font-medium transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-movco-navy">Get Your Moving Quote</h1>
          <p className="text-gray-500 mt-1">AI-powered instant quotes for your move</p>
        </div>

        {/* Free quotes remaining badge */}
        <div className="mb-6 flex justify-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            remainingQuotes === 1
              ? 'bg-orange-100 text-orange-700'
              : 'bg-blue-50 text-movco-blue'
          }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {remainingQuotes} of {totalAllowed} free quote{remainingQuotes !== 1 ? 's' : ''} remaining
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Addresses */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-movco-navy mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-movco-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Moving Addresses
            </h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-600 mb-1">
                  <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Starting Address
                </label>
                <input
                  type="text"
                  value={startingAddress}
                  onChange={(e) => setStartingAddress(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy"
                  placeholder="123 Main St, London"
                  required
                />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-600 mb-1">
                  <svg className="w-4 h-4 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Ending Address
                </label>
                <input
                  type="text"
                  value={endingAddress}
                  onChange={(e) => setEndingAddress(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy"
                  placeholder="456 Oak Ave, Manchester"
                  required
                />
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-movco-navy mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-movco-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upload Room Photos
            </h2>
            <p className="text-xs text-gray-500 mb-4">Add 3-4 photos per room for the most accurate estimate</p>

            {/* Two buttons: Take Photo + Upload from Gallery */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* TAKE PHOTO — opens camera, one photo at a time, accumulates */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-movco-blue hover:bg-blue-50/30 transition-all duration-200 cursor-pointer"
                onClick={() => cameraInputRef.current?.click()}
              >
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraChange}
                  className="hidden"
                />
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-2">
                  <svg className="w-6 h-6 text-movco-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-movco-navy">Take Photo</p>
                <p className="text-xs text-gray-500 mt-0.5">Use your camera</p>
              </div>

              {/* UPLOAD FROM GALLERY — allows multiple selection, accumulates */}
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer ${
                  dragActive
                    ? 'border-movco-blue bg-blue-50'
                    : 'border-gray-200 hover:border-green-500 hover:bg-green-50/30'
                }`}
                onClick={() => galleryInputRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={galleryInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleGalleryChange}
                  className="hidden"
                />
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-2">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-movco-navy">Upload Photos</p>
                <p className="text-xs text-gray-500 mt-0.5">Choose from gallery</p>
              </div>
            </div>

            {/* Photo count badge */}
            {files.length > 0 && (
              <p className="text-xs text-gray-500 font-medium mb-3">
                {files.length} photo{files.length !== 1 ? 's' : ''} ready to upload
              </p>
            )}

            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {files.map((file, idx) => (
                  <div key={idx} className="relative group bg-movco-light rounded-lg border border-gray-200 p-3 flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-movco-blue" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-movco-navy truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200"
                    >
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          {errorText && (
            <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-xl p-4 animate-shake">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{errorText}</p>
            </div>
          )}

          {successText && (
            <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-xl p-4 animate-bounce-in">
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-green-700">{successText}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-movco-blue hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Get Moving Quote
              </span>
            )}
          </button>

          <p className="text-xs text-center text-gray-500 pt-2">
            ✨ Powered by AI • Instant estimates • Secure &amp; Private
          </p>
        </form>

        {/* Trust Indicators */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-movco-blue">&lt; 60s</div>
            <div className="text-xs text-gray-600 font-medium mt-1">Instant Quote</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-green-600">AI</div>
            <div className="text-xs text-gray-600 font-medium mt-1">Powered</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl font-bold text-purple-600">Free</div>
            <div className="text-xs text-gray-600 font-medium mt-1">No Obligation</div>
          </div>
        </div>
      </main>
    </div>
  );
}
