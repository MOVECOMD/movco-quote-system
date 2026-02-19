'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
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

// Group postcodes by first letter for better UX
const POSTCODE_GROUPS: Record<string, string[]> = {};
UK_POSTCODE_AREAS.forEach(pc => {
  const letter = pc[0];
  if (!POSTCODE_GROUPS[letter]) POSTCODE_GROUPS[letter] = [];
  POSTCODE_GROUPS[letter].push(pc);
});

export default function CompanySignUpPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [selectedPostcodes, setSelectedPostcodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          is_company: true,
          full_name: contactName,
          company_name: companyName,
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is off, user is logged in immediately
    // If on, they still get a session in some Supabase configs
    setStep(2);
    setLoading(false);
  };

  const handleCompanyDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !contactName || !phone) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setStep(3);
  };

  const togglePostcode = (pc: string) => {
    setSelectedPostcodes(prev =>
      prev.includes(pc) ? prev.filter(p => p !== pc) : [...prev, pc]
    );
  };

  const selectAllInGroup = (letter: string) => {
    const group = POSTCODE_GROUPS[letter] || [];
    const allSelected = group.every(pc => selectedPostcodes.includes(pc));
    if (allSelected) {
      setSelectedPostcodes(prev => prev.filter(pc => !group.includes(pc)));
    } else {
      setSelectedPostcodes(prev => [...new Set([...prev, ...group])]);
    }
  };

  const handleComplete = async () => {
    if (selectedPostcodes.length === 0) {
      setError('Please select at least one coverage area');
      return;
    }

    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Session expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('companies').insert({
      user_id: user.id,
      company_name: companyName,
      contact_name: contactName,
      email: email,
      phone: phone,
      address: address,
      postcode: postcode,
      coverage_postcodes: selectedPostcodes,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/company-dashboard');
  };

  const filteredAreas = searchFilter
    ? UK_POSTCODE_AREAS.filter(pc => pc.toLowerCase().startsWith(searchFilter.toLowerCase()))
    : UK_POSTCODE_AREAS;

  return (
    <div className="min-h-screen bg-movco-navy flex items-center justify-center px-4 py-12">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, white 1px, transparent 0)`,
          backgroundSize: '50px 50px',
        }} />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/movco-logo.png" alt="MOVCO" width={80} height={80} className="mx-auto rounded-2xl shadow-2xl" />
          <h1 className="text-white text-2xl font-bold mt-4 tracking-wide">MOVCO</h1>
          <div className="inline-flex items-center gap-2 mt-2 bg-amber-500/20 px-3 py-1 rounded-full">
            <span className="text-amber-400 text-xs font-bold">FOR COMPANIES</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6 px-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <div className={`h-1.5 w-full rounded-full transition-all duration-300 ${step >= s ? 'bg-movco-blue' : 'bg-slate-700'}`} />
              <span className={`text-[10px] font-medium ${step >= s ? 'text-movco-blue' : 'text-slate-600'}`}>
                {s === 1 ? 'Account' : s === 2 ? 'Details' : 'Coverage'}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-movco-navy mb-1">
            {step === 1 && 'Create Your Company Account'}
            {step === 2 && 'Company Details'}
            {step === 3 && 'Select Coverage Areas'}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {step === 1 && 'Sign up to start receiving qualified moving leads.'}
            {step === 2 && 'Tell us about your removals business.'}
            {step === 3 && 'Choose the postcode areas you serve. You\'ll receive leads from these areas.'}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Auth */}
          {step === 1 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Contact Name</label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="John Smith" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Business Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="info@yourcompany.co.uk" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters" required minLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-movco-blue hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </span>
                ) : 'Continue'}
              </button>
            </form>
          )}

          {/* Step 2: Company Info */}
          {step === 2 && (
            <form onSubmit={handleCompanyDetails} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Company Name *</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="ABC Removals Ltd" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Phone Number *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="07700 900000" required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Business Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="123 Business Park, London"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-movco-navy mb-1">Business Postcode</label>
                <input type="text" value={postcode} onChange={e => setPostcode(e.target.value)}
                  placeholder="SW1A 1AA"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition">
                  Back
                </button>
                <button type="submit"
                  className="flex-1 bg-movco-blue hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-500/25">
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Postcode Selection */}
          {step === 3 && (
            <div>
              {/* Selected count & search */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  <span className="font-bold text-movco-blue">{selectedPostcodes.length}</span> areas selected
                </div>
                <input
                  type="text"
                  placeholder="Search postcodes..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-36 focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none"
                />
              </div>

              {/* Selected postcodes preview */}
              {selectedPostcodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3 p-2 bg-blue-50 rounded-lg max-h-16 overflow-y-auto">
                  {selectedPostcodes.sort().map(pc => (
                    <span key={pc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-movco-blue text-white text-xs font-mono rounded">
                      {pc}
                      <button onClick={() => togglePostcode(pc)} className="hover:text-red-200">×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Quick select by letter */}
              <div className="flex flex-wrap gap-1 mb-3">
                {Object.keys(POSTCODE_GROUPS).sort().map(letter => {
                  const group = POSTCODE_GROUPS[letter];
                  const allSelected = group.every(pc => selectedPostcodes.includes(pc));
                  const someSelected = group.some(pc => selectedPostcodes.includes(pc));
                  return (
                    <button key={letter} onClick={() => selectAllInGroup(letter)}
                      className={`w-8 h-8 text-xs font-bold rounded transition-all
                        ${allSelected ? 'bg-movco-blue text-white' : someSelected ? 'bg-blue-100 text-movco-blue border border-movco-blue' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Postcode grid */}
              <div className="grid grid-cols-7 gap-1.5 max-h-48 overflow-y-auto mb-4 p-1">
                {filteredAreas.map(pc => (
                  <button key={pc} onClick={() => togglePostcode(pc)}
                    className={`py-1.5 text-xs rounded-lg border font-mono font-semibold transition-all
                      ${selectedPostcodes.includes(pc)
                        ? 'bg-movco-blue text-white border-movco-blue shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-movco-blue hover:text-movco-blue'}`}>
                    {pc}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition">
                  Back
                </button>
                <button onClick={handleComplete} disabled={loading || selectedPostcodes.length === 0}
                  className="flex-1 bg-movco-blue hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Setting up...
                    </span>
                  ) : `Complete Setup`}
                </button>
              </div>
            </div>
          )}

          {/* Login link */}
          {step === 1 && (
            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <button onClick={() => router.push('/auth')}
                className="text-movco-blue hover:text-blue-700 font-medium text-sm transition-colors">
                Already have an account? Sign in
              </button>
            </div>
          )}
        </div>

        {/* Value props */}
        {step === 1 && (
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl mb-1">🎯</div>
              <p className="text-white text-xs font-medium">Qualified Leads</p>
              <p className="text-gray-400 text-[10px]">Customers ready to book</p>
            </div>
            <div>
              <div className="text-2xl mb-1">📍</div>
              <p className="text-white text-xs font-medium">Your Area</p>
              <p className="text-gray-400 text-[10px]">Only pay for local leads</p>
            </div>
            <div>
              <div className="text-2xl mb-1">💰</div>
              <p className="text-white text-xs font-medium">Pay Per Lead</p>
              <p className="text-gray-400 text-[10px]">No monthly fees</p>
            </div>
          </div>
        )}

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2025 MOVCO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
