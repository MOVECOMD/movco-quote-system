'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type QuoteRequest = {
  id: string;
  token: string;
  company_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  moving_from: string | null;
  moving_to: string | null;
  moving_date: string | null;
  status: string;
  notes: string | null;
  expires_at: string;
  completed_quote_id: string | null;
};

type CompanyInfo = {
  name: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
};

type DetectedItem = {
  name: string;
  quantity: number;
  estimated_volume_ft3?: number;
  note?: string;
};

type AnalysisResult = {
  estimate: number;
  description: string;
  items: DetectedItem[];
  totalVolumeM3: number;
  totalAreaM2: number;
  van_count?: number;
  van_description?: string;
  recommended_movers?: number;
  distance_miles?: number;
  duration_text?: string;
  total_volume_ft3?: number;
};

export default function QuoteRequestPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [movingFrom, setMovingFrom] = useState('');
  const [movingTo, setMovingTo] = useState('');
  const [movingDate, setMovingDate] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // Progress state
  const [step, setStep] = useState<'details' | 'photos' | 'uploading' | 'analyzing' | 'complete'>('details');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    async function fetchRequest() {
      if (!token) return;
      try {
        const { data, error: fetchError } = await supabase
          .from('quote_requests')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (fetchError || !data) {
          setError('This quote link is invalid or has expired.');
          setLoading(false);
          return;
        }

        if (data.status === 'completed') {
          setError('This quote has already been submitted. Thank you!');
          setLoading(false);
          return;
        }

        if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
          setError('This quote link has expired. Please contact the company for a new link.');
          setLoading(false);
          return;
        }

        setRequest(data as QuoteRequest);
        setMovingFrom(data.moving_from || '');
        setMovingTo(data.moving_to || '');
        setMovingDate(data.moving_date || '');

        // Fetch company info
        const { data: companyData } = await supabase
          .from('companies')
          .select('name, email, phone, logo_url')
          .eq('id', data.company_id)
          .single();

        if (companyData) setCompany(companyData as CompanyInfo);
      } catch (err: any) {
        setError(err.message || 'Something went wrong.');
      } finally {
        setLoading(false);
      }
    }
    fetchRequest();
  }, [token]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newPhotos = [...photos, ...files].slice(0, 20);
    setPhotos(newPhotos);
    setPhotoPreviews(newPhotos.map((f) => URL.createObjectURL(f)));
  };

  const removePhoto = (idx: number) => {
    const newPhotos = photos.filter((_, i) => i !== idx);
    setPhotos(newPhotos);
    setPhotoPreviews(newPhotos.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    if (!request) return;
    if (!movingFrom.trim() || !movingTo.trim()) {
      alert('Please fill in both the moving from and moving to addresses.');
      return;
    }
    if (photos.length === 0) {
      alert('Please upload at least one photo of your items.');
      return;
    }

    setStep('uploading');

    try {
      // 1. Upload photos to Supabase Storage
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `quote-requests/${request.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-photos')
          .upload(path, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Failed to upload photo');
        }

        const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(path);
        if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);

        setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
      }

      // 2. Call AI analysis API
      setStep('analyzing');

      const aiResponse = await fetch('https://movco-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_address: movingFrom,
          ending_address: movingTo,
          photo_urls: uploadedUrls,
        }),
      });

      let analysisData: AnalysisResult;

      if (aiResponse.ok) {
        const data = await aiResponse.json();
        analysisData = {
          estimate: data.estimate,
          description: data.description,
          items: data.items || [],
          totalVolumeM3: data.totalVolumeM3,
          totalAreaM2: data.totalAreaM2,
          van_count: data.van_count,
          van_description: data.van_description,
          recommended_movers: data.recommended_movers,
          distance_miles: data.distance_miles,
          duration_text: data.duration_text,
          total_volume_ft3: data.total_volume_ft3,
        };
      } else {
        // Fallback estimate
        const photoCount = uploadedUrls.length;
        analysisData = {
          estimate: 1200 + 150 * photoCount,
          description: 'AI analysis temporarily unavailable. A representative will review your photos and provide an accurate quote.',
          items: [{ name: 'Estimated contents', quantity: photoCount * 8 }],
          totalVolumeM3: 20 + photoCount * 2,
          totalAreaM2: 26,
        };
      }

      setAnalysis(analysisData);

      // 3. Save quote to CRM (crm_quotes table)
      const { error: quoteError } = await supabase
        .from('crm_quotes')
        .insert({
          company_id: request.company_id,
          customer_name: request.customer_name,
          customer_email: request.customer_email,
          customer_phone: request.customer_phone,
          moving_from: movingFrom,
          moving_to: movingTo,
          moving_date: movingDate || null,
          photo_urls: uploadedUrls,
          items: analysisData.items,
          total_volume_m3: analysisData.totalVolumeM3,
          van_count: analysisData.van_count,
          movers: analysisData.recommended_movers,
          estimated_price: analysisData.estimate,
          notes: customerNotes || analysisData.description,
          status: 'draft',
        });

      if (quoteError) {
        console.error('Failed to save quote:', quoteError);
      }

      // 4. Update quote_request status to completed
      await supabase
        .from('quote_requests')
        .update({
          status: 'completed',
          moving_from: movingFrom,
          moving_to: movingTo,
          moving_date: movingDate || null,
        })
        .eq('id', request.id);

      setStep('complete');
    } catch (err: any) {
      console.error('Submit error:', err);
      alert('Something went wrong. Please try again.');
      setStep('photos');
    }
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-600 font-medium">Loading your quote request...</p>
        </div>
      </div>
    );
  }

  // ===== ERROR =====
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Quote Unavailable</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  // ===== UPLOADING =====
  if (step === 'uploading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 max-w-md w-full text-center border border-white/20">
          <svg className="animate-spin h-12 w-12 text-blue-400 mx-auto mb-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <h2 className="text-white text-xl font-bold mb-2">Uploading Photos...</h2>
          <div className="w-full bg-white/20 rounded-full h-3 mb-3">
            <div className="bg-blue-400 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-blue-200 text-sm">{uploadProgress}% — {photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  }

  // ===== ANALYZING =====
  if (step === 'analyzing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 max-w-md w-full text-center border border-white/20">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">AI Analyzing Your Items...</h2>
          <p className="text-blue-200 text-sm">Detecting furniture, calculating volumes, and generating your quote. This takes 30-60 seconds.</p>
        </div>
      </div>
    );
  }

  // ===== COMPLETE =====
  if (step === 'complete' && analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Quote Submitted!</h1>
            <p className="text-gray-600 mt-2">
              Your quote has been sent to <span className="font-semibold">{company?.name || 'the company'}</span>. They&apos;ll be in touch soon.
            </p>
          </div>

          {/* Quote Summary */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-white/20">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Move Summary</h2>
            <p className="text-sm text-slate-600 mb-6">Our AI has analyzed your photos. A member of the team will be in touch with your quote shortly.</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{analysis.totalVolumeM3}</p>
                <p className="text-xs text-blue-600">Volume (m³)</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-700">{analysis.van_count ?? '—'}</p>
                <p className="text-xs text-amber-600">Vans</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-purple-700">{analysis.recommended_movers ?? '—'}</p>
                <p className="text-xs text-purple-600">Movers</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-700">{analysis.distance_miles ?? '—'}</p>
                <p className="text-xs text-green-600">Miles</p>
              </div>
            </div>

            {/* Items */}
            {analysis.items.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Items Detected ({analysis.items.reduce((s, i) => s + i.quantity, 0)} total)</h3>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {analysis.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm">
                      <span className="text-slate-700">{item.name}</span>
                      <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Company footer */}
          {company && (
            <div className="text-center text-sm text-gray-500 pb-6">
              Quote provided by <span className="font-semibold text-slate-700">{company.name}</span>
              {company.phone && <> · {company.phone}</>}
              {company.email && <> · {company.email}</>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== FORM: STEP 1 — DETAILS =====
  if (step === 'details') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Company header */}
          <div className="text-center pt-6">
            <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl">
              {company?.name?.charAt(0) || 'M'}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{company?.name || 'Moving Quote'}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Hi {request.customer_name}, please confirm your move details below.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 border border-white/20">
            <h2 className="text-lg font-semibold text-slate-900">Move Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moving From *</label>
              <input
                type="text"
                value={movingFrom}
                onChange={(e) => setMovingFrom(e.target.value)}
                placeholder="e.g. 71 Deepcut Bridge Road, Camberley"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moving To *</label>
              <input
                type="text"
                value={movingTo}
                onChange={(e) => setMovingTo(e.target.value)}
                placeholder="e.g. 22 High Street, Guildford"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moving Date</label>
              <input
                type="date"
                value={movingDate}
                onChange={(e) => setMovingDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Anything we should know? Access issues, fragile items, etc."
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
            </div>

            <button
              onClick={() => {
                if (!movingFrom.trim() || !movingTo.trim()) {
                  alert('Please fill in both addresses.');
                  return;
                }
                setStep('photos');
              }}
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg shadow-lg shadow-blue-500/25"
            >
              Next — Upload Photos →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== FORM: STEP 2 — PHOTOS =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-6">
          <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl">
            {company?.name?.charAt(0) || 'M'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Upload Photos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Take photos of each room showing furniture and items to move.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 border border-white/20">
          {/* Move summary */}
          <div className="bg-slate-50 rounded-xl p-4 text-sm">
            <div className="flex items-center gap-2 text-slate-700 mb-1">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
              <span className="font-medium">{movingFrom}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              <span className="font-medium">{movingTo}</span>
            </div>
          </div>

          {/* Upload area */}
          <div>
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/50 transition">
                <svg className="w-10 h-10 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-semibold text-blue-600">Tap to upload photos</p>
                <p className="text-xs text-gray-500 mt-1">JPG, PNG, HEIC · up to 20 photos</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Photo previews */}
          {photoPreviews.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">{photos.length} photo{photos.length !== 1 ? 's' : ''} selected</p>
              <div className="grid grid-cols-3 gap-2">
                {photoPreviews.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h3 className="text-sm font-semibold text-amber-800 mb-2">📸 Tips for best results</h3>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• Photograph each room from the doorway to capture everything</li>
              <li>• Include contents of wardrobes and cupboards</li>
              <li>• Don&apos;t forget the garage, attic, and garden items</li>
              <li>• More photos = more accurate quote</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('details')}
              className="px-6 py-3.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={photos.length === 0}
              className={`flex-1 font-semibold py-3.5 rounded-xl transition text-lg shadow-lg ${
                photos.length > 0
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-500/25'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              Submit Quote →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
