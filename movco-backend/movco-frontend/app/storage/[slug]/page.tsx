'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type StorageUnit = {
  name: string;
  size: string;
  volume_m3: number;
  monthly_price: number;
};

type Partner = {
  id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  units: StorageUnit[];
};

type DetectedItem = {
  name: string;
  quantity: number;
  estimated_volume_ft3?: number;
};

type AnalysisResult = {
  items: DetectedItem[];
  totalVolumeM3: number;
  van_count?: number;
  recommended_movers?: number;
  description: string;
};

export default function StorageCalculatorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Steps
  const [step, setStep] = useState<'intro' | 'photos' | 'contact' | 'uploading' | 'analyzing' | 'results'>('intro');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recommendedUnit, setRecommendedUnit] = useState<StorageUnit | null>(null);
  const [allUnits, setAllUnits] = useState<StorageUnit[]>([]);

  const pc = partner?.primary_color || '2563EB';

  useEffect(() => {
    async function fetchPartner() {
      if (!slug) return;
      const { data, error: fetchError } = await supabase
        .from('storage_partners')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();

      if (fetchError || !data) {
        setError('Calculator not found.');
        setLoading(false);
        return;
      }
      setPartner(data as Partner);
      setLoading(false);
    }
    fetchPartner();
  }, [slug]);

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
    if (!partner || photos.length === 0) return;

    setStep('uploading');

    try {
      // 1. Upload photos
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `storage-calc/${partner.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-photos')
          .upload(path, file);

        if (uploadError) throw new Error('Upload failed');

        const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(path);
        if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);

        setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
      }

      // 2. AI analysis
      setStep('analyzing');

      const aiResponse = await fetch('https://movco-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_address: 'Storage calculation',
          ending_address: 'Storage facility',
          photo_urls: uploadedUrls,
        }),
      });

      let analysisData: AnalysisResult;

      if (aiResponse.ok) {
        const data = await aiResponse.json();
        analysisData = {
          items: data.items || [],
          totalVolumeM3: data.totalVolumeM3 || 10,
          van_count: data.van_count,
          recommended_movers: data.recommended_movers,
          description: data.description || '',
        };
      } else {
        const photoCount = uploadedUrls.length;
        analysisData = {
          items: [{ name: 'Estimated contents', quantity: photoCount * 8 }],
          totalVolumeM3: 10 + photoCount * 3,
          description: 'Estimate based on number of photos provided.',
        };
      }

      setAnalysis(analysisData);

      // 3. Recommend storage unit
      const units = partner.units as StorageUnit[];
      const volumeNeeded = analysisData.totalVolumeM3 * 1.2;
      const sorted = [...units].sort((a, b) => a.volume_m3 - b.volume_m3);
      const recommended = sorted.find((u) => u.volume_m3 >= volumeNeeded) || sorted[sorted.length - 1];
      setRecommendedUnit(recommended);
      setAllUnits(sorted);

      // 4. Save lead
      await supabase.from('storage_leads').insert({
        partner_id: partner.id,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        photo_urls: uploadedUrls,
        items: analysisData.items,
        total_volume_m3: analysisData.totalVolumeM3,
        recommended_unit: recommended.name,
        recommended_price: recommended.monthly_price,
      });

      // 5. Notify partner via email (fire-and-forget)
      try {
        fetch('/api/notify-partner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner_id: partner.id,
            product_type: 'storage',
            lead_data: {
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              storage_requirements: `${analysisData.totalVolumeM3} m³ across ${analysisData.items.reduce((s: number, i: DetectedItem) => s + i.quantity, 0)} items`,
              recommended_unit: recommended.name,
              quoted_price: `£${recommended.monthly_price}/mo`,
            },
          }),
        });
      } catch (e) {
        console.error('Notification failed:', e);
      }

      setStep('results');
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong. Please try again.');
      setStep('photos');
    }
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Not Found</h2>
          <p className="text-gray-600">{error || 'This calculator is not available.'}</p>
        </div>
      </div>
    );
  }

  // ===== INTRO =====
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-white py-16 px-6" style={{ backgroundColor: `#${pc}` }}>
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">How Much Storage Do You Need?</h1>
            <p className="text-lg opacity-90 mb-2">Powered by AI — just take photos of your items</p>
            <p className="text-sm opacity-75">Our AI will detect every item, calculate the total volume, and recommend the perfect storage unit size for you.</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg" style={{ backgroundColor: `#${pc}` }}>1</div>
              <h3 className="font-semibold text-gray-900 mb-1">Take Photos</h3>
              <p className="text-sm text-gray-500">Photograph each room or area with items you need to store</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg" style={{ backgroundColor: `#${pc}` }}>2</div>
              <h3 className="font-semibold text-gray-900 mb-1">AI Analyzes</h3>
              <p className="text-sm text-gray-500">Our AI detects every item and calculates the total volume</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg" style={{ backgroundColor: `#${pc}` }}>3</div>
              <h3 className="font-semibold text-gray-900 mb-1">Get Your Size</h3>
              <p className="text-sm text-gray-500">See exactly which unit size fits your items and the monthly cost</p>
            </div>
          </div>

          <button
            onClick={() => setStep('photos')}
            className="w-full text-white font-semibold py-4 rounded-xl text-lg shadow-lg transition hover:opacity-90"
            style={{ backgroundColor: `#${pc}` }}
          >
            Get Started — It&apos;s Free
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Powered by {partner.company_name} × MOVCO AI
          </p>
        </div>
      </div>
    );
  }

  // ===== PHOTOS =====
  if (step === 'photos') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center pt-4">
            <h1 className="text-2xl font-bold text-gray-900">Upload Photos</h1>
            <p className="text-gray-500 text-sm mt-1">Photograph each room or area with items you want to store.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed rounded-xl p-8 text-center transition hover:bg-gray-50" style={{ borderColor: `#${pc}40` }}>
                <svg className="w-10 h-10 mx-auto mb-3 opacity-60" style={{ color: `#${pc}` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: `#${pc}` }}>Tap to upload photos</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, HEIC · up to 20 photos</p>
              </div>
              <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotoChange} className="hidden" />
            </label>

            {photoPreviews.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
                <div className="grid grid-cols-3 gap-2">
                  {photoPreviews.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                      <button onClick={() => removePhoto(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">📸 Tips</h3>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Photograph each room from the doorway</li>
                <li>• Include wardrobes, cupboards & garage items</li>
                <li>• More photos = more accurate results</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('intro')} className="px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
              <button
                onClick={() => { if (photos.length === 0) { alert('Please upload at least one photo.'); return; } setStep('contact'); }}
                disabled={photos.length === 0}
                className={`flex-1 font-semibold py-3 rounded-xl transition text-white ${photos.length > 0 ? 'hover:opacity-90 shadow-lg' : 'opacity-40 cursor-not-allowed'}`}
                style={{ backgroundColor: `#${pc}` }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== CONTACT (optional) =====
  if (step === 'contact') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center pt-4">
            <h1 className="text-2xl font-bold text-gray-900">Almost There!</h1>
            <p className="text-gray-500 text-sm mt-1">Leave your details so we can send your results (optional).</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none" style={{ '--tw-ring-color': `#${pc}` } as any} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('photos')} className="px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
              <button
                onClick={handleSubmit}
                className="flex-1 text-white font-semibold py-3 rounded-xl transition hover:opacity-90 shadow-lg"
                style={{ backgroundColor: `#${pc}` }}
              >
                Calculate My Storage →
              </button>
            </div>

            <button onClick={handleSubmit} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition">
              Skip — just show me results
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== UPLOADING =====
  if (step === 'uploading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: `#${pc}` }}>
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 max-w-md w-full text-center border border-white/20">
          <svg className="animate-spin h-12 w-12 text-white mx-auto mb-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <h2 className="text-white text-xl font-bold mb-2">Uploading Photos...</h2>
          <div className="w-full bg-white/20 rounded-full h-3 mb-3">
            <div className="bg-white h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-white/80 text-sm">{uploadProgress}%</p>
        </div>
      </div>
    );
  }

  // ===== ANALYZING =====
  if (step === 'analyzing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: `#${pc}` }}>
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 max-w-md w-full text-center border border-white/20">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <h2 className="text-white text-xl font-bold mb-2">AI Analyzing Your Items...</h2>
          <p className="text-white/70 text-sm">Detecting items and calculating volume. This takes 30-60 seconds.</p>
        </div>
      </div>
    );
  }

  // ===== RESULTS =====
  if (step === 'results' && analysis && recommendedUnit) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center pt-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `#${pc}20` }}>
              <svg className="w-8 h-8" style={{ color: `#${pc}` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Your Storage Recommendation</h1>
            <p className="text-gray-500 mt-1">Based on AI analysis of {photos.length} photo{photos.length !== 1 ? 's' : ''}</p>
          </div>

          <div className="text-white rounded-2xl shadow-xl p-8 text-center" style={{ backgroundColor: `#${pc}` }}>
            <p className="text-sm font-medium opacity-80 mb-2">WE RECOMMEND</p>
            <h2 className="text-4xl font-bold mb-1">{recommendedUnit.name}</h2>
            <p className="text-lg opacity-90 mb-4">{recommendedUnit.size}</p>
            <div className="inline-flex items-baseline gap-1 bg-white/20 backdrop-blur rounded-xl px-6 py-3">
              <span className="text-4xl font-bold">£{recommendedUnit.monthly_price}</span>
              <span className="text-sm opacity-80">/month</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Items</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{analysis.totalVolumeM3}</p>
                <p className="text-xs text-blue-600 font-medium">Volume (m³)</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{analysis.items.reduce((s, i) => s + i.quantity, 0)}</p>
                <p className="text-xs text-green-600 font-medium">Items Detected</p>
              </div>
            </div>
            {analysis.items.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 border-t border-gray-100 pt-3">
                {analysis.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All Available Units</h3>
            <div className="space-y-3">
              {allUnits.map((unit, idx) => {
                const isRecommended = unit.name === recommendedUnit.name;
                const fits = unit.volume_m3 >= analysis.totalVolumeM3;
                return (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 border-2 transition ${
                      isRecommended
                        ? 'border-current shadow-md'
                        : fits
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-gray-100 opacity-60'
                    }`}
                    style={isRecommended ? { borderColor: `#${pc}`, backgroundColor: `#${pc}08` } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{unit.name}</h4>
                          {isRecommended && (
                            <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: `#${pc}` }}>
                              BEST FIT
                            </span>
                          )}
                          {!fits && <span className="text-xs text-red-500 font-medium">Too small</span>}
                        </div>
                        <p className="text-sm text-gray-500">{unit.size} · up to {unit.volume_m3} m³</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">£{unit.monthly_price}</p>
                        <p className="text-xs text-gray-500">/month</p>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (analysis.totalVolumeM3 / unit.volume_m3) * 100)}%`,
                          backgroundColor: fits ? `#${pc}` : '#EF4444',
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{Math.round((analysis.totalVolumeM3 / unit.volume_m3) * 100)}% filled</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 text-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Ready to Book?</h3>
            <p className="text-sm text-gray-500">Contact {partner.company_name} to reserve your unit.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {partner.phone && (
                <a href={`tel:${partner.phone}`} className="flex-1 inline-flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl transition hover:opacity-90 shadow-lg" style={{ backgroundColor: `#${pc}` }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  Call Us
                </a>
              )}
              {partner.email && (
                <a href={`mailto:${partner.email}?subject=Storage Unit Enquiry&body=Hi, I used your storage calculator and I'm interested in the ${recommendedUnit.name}.`} className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold py-3.5 rounded-xl transition hover:bg-gray-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Email Us
                </a>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 pb-6">
            Powered by {partner.company_name} × MOVCO AI
          </p>
        </div>
      </div>
    );
  }

  return null;
}
