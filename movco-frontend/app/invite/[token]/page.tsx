// app/invite/[token]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

type InviteData = {
  id: string;
  company_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted: boolean;
  company_name?: string;
};

export default function InviteAcceptPage() {
  const { user, loading: authLoading, signIn, signUp, refreshCompanyUser } = useAuth();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [authLoading2, setAuthLoading2] = useState(false);
  const [authError, setAuthError] = useState('');

  // Load invite
  useEffect(() => {
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('company_invites').select('*').eq('token', token).maybeSingle();

      if (fetchErr || !data) {
        setError('Invalid or expired invite link.'); setLoading(false); return;
      }
      if (data.accepted) {
        setError('This invite has already been accepted.'); setLoading(false); return;
      }
      if (new Date(data.expires_at) < new Date()) {
        setError('This invite has expired. Ask your admin to send a new one.'); setLoading(false); return;
      }

      const { data: co } = await supabase
        .from('companies').select('name').eq('id', data.company_id).single();

      setInvite({ ...data, company_name: co?.name || 'Unknown' });
      setEmail(data.email);
      setLoading(false);
    })();
  }, [token]);

  // Auto-accept if logged in
  useEffect(() => {
    if (!authLoading && user && invite && !success) {
      acceptInvite(user.id, user.email || invite.email);
    }
  }, [user, authLoading, invite]);

  const acceptInvite = async (userId: string, userEmail: string) => {
    if (!invite) return;
    try {
      const { error: updateErr } = await supabase.from('company_users')
        .update({ user_id: userId, status: 'active', joined_at: new Date().toISOString() })
        .eq('company_id', invite.company_id).eq('email', invite.email).eq('status', 'invited');

      if (updateErr) {
        const { error: insertErr } = await supabase.from('company_users').insert({
          company_id: invite.company_id, user_id: userId, email: userEmail,
          name: name || userEmail.split('@')[0], role: invite.role,
          status: 'active', joined_at: new Date().toISOString(),
        });
        if (insertErr) { setError('Failed to join team: ' + insertErr.message); return; }
      }

      await supabase.from('company_invites').update({ accepted: true }).eq('id', invite.id);
      if (refreshCompanyUser) await refreshCompanyUser();
      setSuccess(true);
    } catch (err: any) {
      setError('Something went wrong: ' + (err.message || 'Unknown error'));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(''); setAuthLoading2(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) { setAuthError(error.message); setAuthLoading2(false); return; }
      } else {
        if (!name || !phone) { setAuthError('Please fill in all fields'); setAuthLoading2(false); return; }
        const { data, error } = await signUp(email, password, name, phone);
        if (error) { setAuthError(error.message); setAuthLoading2(false); return; }
        if (data?.user?.identities?.length === 0) {
          setAuthError('Account exists. Try signing in.'); setIsLogin(true); setAuthLoading2(false); return;
        }
        const { error: signInErr } = await signIn(email, password);
        if (signInErr) { setAuthError('Account created. Please sign in.'); setAuthLoading2(false); return; }
      }
    } catch { setAuthError('Something went wrong.'); }
    setAuthLoading2(false);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center px-4">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, white 1px, transparent 0)', backgroundSize: '50px 50px' }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/movco-logo.png" alt="MOVCO" width={80} height={80} className="mx-auto rounded-2xl shadow-2xl" />
          <h1 className="text-white text-2xl font-bold mt-4">MOVCO</h1>
        </div>

        {/* Error */}
        {error && !invite && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-4xl mb-4">😕</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Not Found</h2>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button onClick={() => router.push('/auth')}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
              Go to Sign In
            </button>
          </div>
        )}

        {/* Success */}
        {success && invite && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to {invite.company_name}!</h2>
            <p className="text-gray-500 text-sm mb-2">
              You have joined as <strong className="text-gray-700 capitalize">{invite.role}</strong>.
            </p>
            <p className="text-gray-400 text-xs mb-6">You now have access to the company dashboard.</p>
            <button onClick={() => router.push('/company-dashboard')}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-500/25">
              Open Dashboard
            </button>
          </div>
        )}

        {/* Auth form */}
        {invite && !success && !user && (
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
              <p className="text-sm text-blue-700">
                <strong>{invite.company_name}</strong> invited you as <strong className="capitalize">{invite.role}</strong>
              </p>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{authError}</div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Full Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Phone Number</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07700 900000"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" />
              </div>
              <button type="submit" disabled={authLoading2}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition shadow-lg shadow-blue-500/25 disabled:opacity-50">
                {authLoading2 ? 'Please wait...' : isLogin ? 'Sign In & Join Team' : 'Create Account & Join Team'}
              </button>
            </form>

            <div className="text-center mt-6 pt-6 border-t border-gray-100">
              <button onClick={() => { setIsLogin(!isLogin); setAuthError(''); }}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {invite && !success && user && !error && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-gray-700 font-medium">Joining {invite.company_name}...</p>
          </div>
        )}

        <p className="text-center text-gray-500 text-xs mt-6">MOVCO</p>
      </div>
    </div>
  );
}
