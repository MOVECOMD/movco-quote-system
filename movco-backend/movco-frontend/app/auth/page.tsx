'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        } else {
          const { data: { user: signedInUser } } = await supabase.auth.getUser();
          if (signedInUser) {
            // Check if user is an admin
            const { data: adminUser } = await supabase
              .from('admin_users')
              .select('id')
              .eq('email', signedInUser.email)
              .single();

            if (adminUser) {
              router.push('/admin');
            } else {
              // Check if user is a company
              const { data: company } = await supabase
                .from('companies')
                .select('id')
                .eq('user_id', signedInUser.id)
                .single();
              if (company) {
                router.push('/company-dashboard');
              } else {
                router.push('/instant-quote');
              }
            }
          } else {
            router.push('/instant-quote');
          }
        }
      } else {
        if (!name || !phone) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        const { data, error } = await signUp(email, password, name, phone);
        if (error) {
          setError(error.message);
        } else {
          if (data?.user?.identities?.length === 0) {
            setError('An account with this email already exists.');
          } else {
            // GA4: Track new sign-up
            window.movcoTrackSignUp?.();

            setSuccess('Account created! You can now sign in.');
            setIsLogin(true);
            setEmail(email);
            setPassword('');
          }
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-movco-navy flex items-center justify-center px-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, white 1px, transparent 0)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/movco-logo.png"
            alt="MOVCO"
            width={100}
            height={100}
            className="mx-auto rounded-2xl shadow-2xl"
          />
          <h1 className="text-white text-3xl font-bold mt-4 tracking-wide">
            MOVCO
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isLogin ? 'Sign in to manage your quotes' : 'Create your account to get started'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-movco-navy mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-movco-navy mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07700 900000"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-movco-navy mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@movco.co.uk"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-movco-navy mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-movco-blue focus:border-transparent outline-none transition text-movco-navy placeholder-gray-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-movco-blue hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Please wait...
                </span>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="text-center mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }}
              className="text-movco-blue hover:text-blue-700 font-medium text-sm transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          © 2025 MOVCO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
