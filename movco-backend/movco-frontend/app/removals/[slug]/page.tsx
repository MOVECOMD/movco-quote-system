'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type VanType = {
  name: string;
  capacity_m3: number;
  crew: number;
  hourly: number;
  label: string;
};

type Pricing = {
  base_hourly: number;
  min_hours: number;
  per_mile: number;
  packing_flat: number;
  disassembly_flat: number;
  insurance_included: boolean;
};

type Partner = {
  id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  pricing: Pricing;
  van_types: VanType[];
};

type DetectedItem = {
  name: string;
  quantity: number;
  estimated_volume_ft3?: number;
};

type AnalysisResult = {
  items: DetectedItem[];
  totalVolumeM3: number;
  totalVolumeFt3?: number;
  estimated_hours?: number;
  van_count?: number;
  recommended_movers?: number;
  description: string;
};

type Quote = {
  van: VanType;
  all_vans: VanType[];
  hours: number;
  crew: number;
  low: number;
  high: number;
  breakdown: {
    labour: number;
    mileage: number;
    packing: number;
    disassembly: number;
  };
};

type Extras = {
  packing: boolean;
  disassembly: boolean;
  storage: boolean;
};

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const PROPERTY_TYPES = [
  { id: 'studio', label: 'Studio', icon: '🏠', desc: '1 room' },
  { id: '1bed', label: '1 Bed', icon: '🛏️', desc: '2-3 rooms' },
  { id: '2bed', label: '2 Bed', icon: '🏡', desc: '4-5 rooms' },
  { id: '3bed', label: '3 Bed', icon: '🏘️', desc: '6-8 rooms' },
  { id: '4bed', label: '4+ Bed', icon: '🏰', desc: '9+ rooms' },
  { id: 'office', label: 'Office', icon: '💼', desc: 'Commercial' },
];

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function RemovalsCalculatorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Steps: intro → details → photos → contact → uploading → analyzing → results
  const [step, setStep] = useState<
    'intro' | 'details' | 'photos' | 'contact' | 'uploading' | 'analyzing' | 'results'
  >('intro');

  // Move details
  const [propertyType, setPropertyType] = useState('');
  const [moveFrom, setMoveFrom] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const [moveDate, setMoveDate] = useState('');
  const [flexibility, setFlexibility] = useState('exact');
  const [extras, setExtras] = useState<Extras>({ packing: false, disassembly: false, storage: false });

  // Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // Contact
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Progress & results
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  const pc = partner?.primary_color || '2563EB';

  // ─── Fetch partner from Supabase ───
  useEffect(() => {
    async function fetchPartner() {
      if (!slug) return;
      const { data, error: fetchError } = await supabase
        .from('removals_partners')
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

  // ─── Photo handlers ───
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

  // ─── Quote calculation ───
  const calculateQuote = (analysisData: AnalysisResult, partnerData: Partner): Quote => {
    const vans = partnerData.van_types as VanType[];
    const volumeNeeded = analysisData.totalVolumeM3 * 1.15; // 15% buffer
    const sorted = [...vans].sort((a, b) => a.capacity_m3 - b.capacity_m3);
    const recommended = sorted.find((v) => v.capacity_m3 >= volumeNeeded) || sorted[sorted.length - 1];

    const hours = analysisData.estimated_hours || 4;
    const labour = recommended.hourly * hours;
    const mileageEstimate = 15; // default miles, could be calculated from addresses
    const mileageCost = mileageEstimate * partnerData.pricing.per_mile;
    const packingCost = extras.packing ? partnerData.pricing.packing_flat : 0;
    const disassemblyCost = extras.disassembly ? partnerData.pricing.disassembly_flat : 0;

    const totalLow = Math.round(labour + mileageCost + packingCost + disassemblyCost);
    const totalHigh = Math.round(totalLow * 1.25);

    return {
      van: recommended,
      all_vans: sorted,
      hours,
      crew: recommended.crew,
      low: totalLow,
      high: totalHigh,
      breakdown: {
        labour,
        mileage: mileageCost,
        packing: packingCost,
        disassembly: disassemblyCost,
      },
    };
  };

  // ─── Submit flow ───
  const handleSubmit = async () => {
    if (!partner || photos.length === 0) return;

    setStep('uploading');

    try {
      // 1. Upload photos to Supabase Storage
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `removals-calc/${partner.id}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-photos')
          .upload(path, file);

        if (uploadError) throw new Error('Upload failed');

        const { data: urlData } = supabase.storage.from('quote-photos').getPublicUrl(path);
        if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);

        setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
      }

      // 2. AI analysis via MOVCO API
      setStep('analyzing');

      const aiResponse = await fetch('https://movco-api.onrender.com/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          starting_address: moveFrom || 'Origin',
          ending_address: moveTo || 'Destination',
          photo_urls: uploadedUrls,
        }),
      });

      let analysisData: AnalysisResult;

      if (aiResponse.ok) {
        const data = await aiResponse.json();
        analysisData = {
          items: data.items || [],
          totalVolumeM3: data.totalVolumeM3 || 10,
          totalVolumeFt3: data.totalVolumeFt3,
          estimated_hours: data.estimated_hours,
          van_count: data.van_count,
          recommended_movers: data.recommended_movers,
          description: data.description || '',
        };
      } else {
        // Fallback estimate based on photo count
        const photoCount = uploadedUrls.length;
        analysisData = {
          items: [{ name: 'Estimated contents', quantity: photoCount * 8 }],
          totalVolumeM3: 10 + photoCount * 3,
          estimated_hours: 3 + photoCount,
          description: 'Estimate based on number of photos provided.',
        };
      }

      setAnalysis(analysisData);

      // 3. Calculate quote
      const quoteData = calculateQuote(analysisData, partner);
      setQuote(quoteData);

      // 4. Save lead to Supabase
      await supabase.from('removals_leads').insert({
        partner_id: partner.id,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        property_type: propertyType || null,
        move_from: moveFrom || null,
        move_to: moveTo || null,
        move_date: moveDate || null,
        flexibility: flexibility || null,
        extras,
        photo_urls: uploadedUrls,
        items: analysisData.items,
        total_volume_m3: analysisData.totalVolumeM3,
        total_volume_ft3: analysisData.totalVolumeFt3 || null,
        estimated_hours: analysisData.estimated_hours || null,
        recommended_van: quoteData.van.name,
        recommended_crew: quoteData.crew,
        quote_low: quoteData.low,
        quote_high: quoteData.high,
        quote_breakdown: quoteData.breakdown,
      });

      setStep('results');
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong. Please try again.');
      setStep('photos');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  LOADING STATE
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  //  INTRO
  // ═══════════════════════════════════════════════════════════════

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-white py-16 px-6" style={{ backgroundColor: `#${pc}` }}>
          <div className="max-w-2xl mx-auto text-center">
            {partner.logo_url ? (
              <img src={partner.logo_url} alt={partner.company_name} className="h-12 mx-auto mb-6 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Get Your Moving Quote in 2 Minutes</h1>
            <p className="text-lg opacity-90 mb-2">Powered by AI — just take photos of your rooms</p>
            <p className="text-sm opacity-75">Our AI will detect every item, calculate the total volume, and give you an instant, accurate moving quote.</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            {[
              { n: '1', title: 'Tell Us About Your Move', desc: 'Property type, addresses, and your preferred date' },
              { n: '2', title: 'Upload Room Photos', desc: 'Snap each room — our AI detects every item automatically' },
              { n: '3', title: 'Get Your Instant Quote', desc: 'Van size, crew, estimated hours, and a clear price range' },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-lg" style={{ backgroundColor: `#${pc}` }}>{s.n}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('details')}
            className="w-full text-white font-semibold py-4 rounded-xl text-lg shadow-lg transition hover:opacity-90"
            style={{ backgroundColor: `#${pc}` }}
          >
            Get My Free Quote →
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Powered by {partner.company_name} × MOVCO AI
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  MOVE DETAILS
  // ═══════════════════════════════════════════════════════════════

  if (step === 'details') {
    const canProceed = propertyType && moveFrom && moveTo;
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Progress bar */}
          <div className="flex gap-1.5 pt-4">
            {['details', 'photos', 'contact'].map((s, i) => (
              <div key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: i === 0 ? `#${pc}` : '#E5E7EB' }} />
            ))}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">About Your Move</h1>
            <p className="text-gray-500 text-sm mt-1">Tell us the basics so we can give you the most accurate quote.</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">
            {/* Property type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Property Type</label>
              <div className="grid grid-cols-3 gap-2">
                {PROPERTY_TYPES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPropertyType(p.id)}
                    className={`p-3 rounded-xl border-2 text-center transition ${
                      propertyType === p.id ? 'shadow-md' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={propertyType === p.id ? { borderColor: `#${pc}`, backgroundColor: `#${pc}08` } : {}}
                  >
                    <div className="text-xl mb-1">{p.icon}</div>
                    <div className="text-xs font-semibold text-gray-900">{p.label}</div>
                    <div className="text-[10px] text-gray-400">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Addresses */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Moving From</label>
              <input
                type="text"
                value={moveFrom}
                onChange={(e) => setMoveFrom(e.target.value)}
                placeholder="e.g. 14 High Street, Reading RG1 2AG"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': `#${pc}` } as any}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Moving To</label>
              <input
                type="text"
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                placeholder="e.g. 7 Oak Lane, Oxford OX1 3BA"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': `#${pc}` } as any}
              />
            </div>

            {/* Date + Flexibility */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Move Date</label>
                <input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': `#${pc}` } as any}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Flexibility</label>
                <select
                  value={flexibility}
                  onChange={(e) => setFlexibility(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none bg-white"
                  style={{ '--tw-ring-color': `#${pc}` } as any}
                >
                  <option value="exact">Exact date</option>
                  <option value="flexible_1">± 1 day</option>
                  <option value="flexible_3">± 3 days</option>
                  <option value="flexible_week">± 1 week</option>
                </select>
              </div>
            </div>

            {/* Extras */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Optional Extras</label>
              <div className="space-y-2">
                {[
                  { key: 'packing' as const, label: 'Packing Service', price: `+£${partner.pricing.packing_flat}`, desc: 'We pack everything for you' },
                  { key: 'disassembly' as const, label: 'Furniture Disassembly', price: `+£${partner.pricing.disassembly_flat}`, desc: 'We take apart beds, tables, etc.' },
                  { key: 'storage' as const, label: 'Short-Term Storage', price: 'Quote', desc: 'Need storage between moves?' },
                ].map((x) => (
                  <button
                    key={x.key}
                    onClick={() => setExtras({ ...extras, [x.key]: !extras[x.key] })}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                      extras[x.key] ? 'shadow-sm' : 'border-gray-200'
                    }`}
                    style={extras[x.key] ? { borderColor: `#${pc}`, backgroundColor: `#${pc}06` } : {}}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        extras[x.key] ? 'text-white' : 'border-gray-300'
                      }`}
                      style={extras[x.key] ? { backgroundColor: `#${pc}`, borderColor: `#${pc}` } : {}}
                    >
                      {extras[x.key] && <span className="text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{x.label}</div>
                      <div className="text-xs text-gray-400">{x.desc}</div>
                    </div>
                    <div className="text-xs font-semibold flex-shrink-0" style={{ color: `#${pc}` }}>{x.price}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('intro')} className="px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
            <button
              onClick={() => { if (canProceed) setStep('photos'); }}
              disabled={!canProceed}
              className={`flex-1 font-semibold py-3 rounded-xl transition text-white ${canProceed ? 'hover:opacity-90 shadow-lg' : 'opacity-40 cursor-not-allowed'}`}
              style={{ backgroundColor: `#${pc}` }}
            >
              Next: Upload Photos →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  PHOTOS
  // ═══════════════════════════════════════════════════════════════

  if (step === 'photos') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex gap-1.5 pt-4">
            {['details', 'photos', 'contact'].map((s, i) => (
              <div key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: i <= 1 ? `#${pc}` : '#E5E7EB' }} />
            ))}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Room Photos</h1>
            <p className="text-gray-500 text-sm mt-1">Photograph each room. Our AI will detect every item and calculate the volume.</p>
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
                <div className="grid grid-cols-4 gap-2">
                  {photoPreviews.map((url, idx) => (
                    <div key={idx} className="relative group aspect-square">
                      <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
                      <button onClick={() => removePhoto(idx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">📸 Tips for best results</h3>
              <ul className="text-xs text-amber-700 space-y-1">
                <li>• Stand in the doorway of each room</li>
                <li>• Open wardrobes &amp; cupboards so contents are visible</li>
                <li>• Include garage, loft, and shed items</li>
                <li>• More photos = more accurate quote</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('details')} className="px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
            <button
              onClick={() => { if (photos.length === 0) { alert('Please upload at least one photo.'); return; } setStep('contact'); }}
              disabled={photos.length === 0}
              className={`flex-1 font-semibold py-3 rounded-xl transition text-white ${photos.length > 0 ? 'hover:opacity-90 shadow-lg' : 'opacity-40 cursor-not-allowed'}`}
              style={{ backgroundColor: `#${pc}` }}
            >
              Next: Your Details →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONTACT (optional)
  // ═══════════════════════════════════════════════════════════════

  if (step === 'contact') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex gap-1.5 pt-4">
            {['details', 'photos', 'contact'].map((s) => (
              <div key={s} className="flex-1 h-1 rounded-full" style={{ backgroundColor: `#${pc}` }} />
            ))}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Almost There!</h1>
            <p className="text-gray-500 text-sm mt-1">Leave your details so we can send your quote (optional).</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none" style={{ '--tw-ring-color': `#${pc}` } as any} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="you@example.com" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none" style={{ '--tw-ring-color': `#${pc}` } as any} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:outline-none" style={{ '--tw-ring-color': `#${pc}` } as any} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('photos')} className="px-5 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition">← Back</button>
              <button
                onClick={handleSubmit}
                className="flex-1 text-white font-semibold py-3 rounded-xl transition hover:opacity-90 shadow-lg"
                style={{ backgroundColor: `#${pc}` }}
              >
                Get My Quote →
              </button>
            </div>

            <button onClick={handleSubmit} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition">
              Skip — just show my quote
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPLOADING
  // ═══════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════
  //  ANALYZING
  // ═══════════════════════════════════════════════════════════════

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
          <h2 className="text-white text-xl font-bold mb-2">AI Analysing Your Items...</h2>
          <p className="text-white/70 text-sm">Detecting furniture, boxes, and appliances. This takes 30-60 seconds.</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESULTS
  // ═══════════════════════════════════════════════════════════════

  if (step === 'results' && analysis && quote) {
    const totalItems = analysis.items.reduce((s, i) => s + i.quantity, 0);

    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center pt-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `#${pc}20` }}>
              <svg className="w-8 h-8" style={{ color: `#${pc}` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Your Moving Quote</h1>
            <p className="text-gray-500 mt-1">
              Based on AI analysis of {photos.length} photo{photos.length !== 1 ? 's' : ''}
              {moveFrom && moveTo && <span> · {moveFrom.split(',')[0]} → {moveTo.split(',')[0]}</span>}
            </p>
          </div>

          {/* Quote Hero */}
          <div className="text-white rounded-2xl shadow-xl p-8 text-center" style={{ backgroundColor: `#${pc}` }}>
            <p className="text-sm font-medium opacity-80 mb-2 tracking-wider uppercase">Estimated Quote</p>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-5xl font-bold">£{quote.low}</span>
              <span className="text-2xl opacity-60">–</span>
              <span className="text-5xl font-bold">£{quote.high}</span>
            </div>
            <p className="text-base opacity-90 mb-6">{quote.van.name} · {quote.crew}-person crew · ~{quote.hours} hours</p>

            <div className="flex gap-2 justify-center flex-wrap">
              {[
                { val: `${analysis.totalVolumeM3} m³`, label: 'Volume' },
                { val: totalItems, label: 'Items' },
                { val: `${quote.hours} hrs`, label: 'Est. Time' },
                { val: quote.crew, label: 'Crew' },
              ].map((m) => (
                <div key={m.label} className="bg-white/15 backdrop-blur rounded-xl px-4 py-2.5 min-w-[70px]">
                  <div className="text-lg font-bold">{m.val}</div>
                  <div className="text-[10px] opacity-75">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Breakdown</h3>
            {[
              { label: `Labour (${quote.van.name}, ${quote.hours}hrs × £${quote.van.hourly})`, val: quote.breakdown.labour },
              { label: 'Mileage estimate', val: quote.breakdown.mileage },
              ...(quote.breakdown.packing > 0 ? [{ label: 'Packing service', val: quote.breakdown.packing }] : []),
              ...(quote.breakdown.disassembly > 0 ? [{ label: 'Furniture disassembly', val: quote.breakdown.disassembly }] : []),
            ].map((row) => (
              <div key={row.label} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{row.label}</span>
                <span className="text-sm font-semibold text-gray-900">£{Math.round(row.val)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <span className="text-sm font-bold text-gray-900">Estimated Total</span>
              <span className="text-sm font-bold" style={{ color: `#${pc}` }}>£{quote.low} – £{quote.high}</span>
            </div>
            {partner.pricing.insurance_included && (
              <div className="mt-4 bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
                <span>🛡️</span>
                <span className="text-xs text-emerald-700 font-medium">Public liability insurance included</span>
              </div>
            )}
          </div>

          {/* Items Detected */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Items Detected ({totalItems})</h3>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {analysis.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `#${pc}10`, color: `#${pc}` }}>×{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Van Options */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Van Options</h3>
            <div className="space-y-3">
              {quote.all_vans.map((van, idx) => {
                const isRecommended = van.name === quote.van.name;
                const fits = van.capacity_m3 >= analysis.totalVolumeM3;
                const pct = Math.min(100, Math.round((analysis.totalVolumeM3 / van.capacity_m3) * 100));
                return (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 border-2 transition ${
                      isRecommended ? 'shadow-md' : fits ? 'border-gray-100' : 'border-gray-100 opacity-50'
                    }`}
                    style={isRecommended ? { borderColor: `#${pc}`, backgroundColor: `#${pc}08` } : {}}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{van.name}</h4>
                          {isRecommended && (
                            <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: `#${pc}` }}>BEST FIT</span>
                          )}
                          {!fits && <span className="text-xs text-red-500 font-medium">Too small</span>}
                        </div>
                        <p className="text-xs text-gray-500">{van.label} · {van.crew} crew · up to {van.capacity_m3} m³</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">£{van.hourly}</p>
                        <p className="text-xs text-gray-500">/hour</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: fits ? `#${pc}` : '#EF4444',
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{pct}% capacity</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Ready to Book Your Move?</h3>
            <p className="text-sm text-gray-500">Contact {partner.company_name} to confirm your date and finalise the price.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {partner.phone && (
                <a
                  href={`tel:${partner.phone}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 text-white font-semibold py-3.5 rounded-xl transition hover:opacity-90 shadow-lg"
                  style={{ backgroundColor: `#${pc}` }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  Call Us
                </a>
              )}
              {partner.email && (
                <a
                  href={`mailto:${partner.email}?subject=Moving Quote Enquiry&body=Hi, I used your online quote tool and received an estimate of £${quote.low}-£${quote.high} for my move${moveFrom ? ` from ${moveFrom}` : ''}${moveTo ? ` to ${moveTo}` : ''}${moveDate ? ` on ${moveDate}` : ''}. I'd like to discuss further.`}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 font-semibold py-3.5 rounded-xl transition hover:bg-gray-200"
                >
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
