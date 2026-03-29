'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'signup' | 'verify'>('signup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
  })

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No user returned')

      // 2. Create company row
      const { data: company, error: companyError } = await supabase
  .from('companies')
  .insert({
    company_name: form.company,
    contact_name: form.name,
    email: form.email,
    user_id: authData.user.id,
    template_type: 'removals',
    onboarding_complete: false,
    plan: 'trial',
    plan_status: 'trial',
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  })
  .select()
  .single()

      if (companyError) throw companyError

      // 3. Go to onboarding
      router.push('/onboarding')

    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    }

    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9FAFB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '40px', height: '40px', background: '#0F6E56',
            borderRadius: '10px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '500', color: '#0e1117', marginBottom: '6px' }}>
            Create your account
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', fontWeight: '300' }}>
            14-day free trial · No credit card required
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '32px',
        }}>
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Your name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="John Smith"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid #E5E7EB', fontSize: '14px',
                  fontFamily: 'inherit', outline: 'none', color: '#111827',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Company name
              </label>
              <input
                type="text"
                required
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="Mike's Plumbing Services"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid #E5E7EB', fontSize: '14px',
                  fontFamily: 'inherit', outline: 'none', color: '#111827',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@mikesplumbing.co.uk"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid #E5E7EB', fontSize: '14px',
                  fontFamily: 'inherit', outline: 'none', color: '#111827',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="At least 8 characters"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid #E5E7EB', fontSize: '14px',
                  fontFamily: 'inherit', outline: 'none', color: '#111827',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: '8px', padding: '10px 14px',
                fontSize: '13px', color: '#DC2626',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: '9px',
                background: loading ? '#9CA3AF' : '#0F6E56',
                color: '#fff', fontSize: '14px', fontWeight: '500',
                border: 'none', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit', marginTop: '4px',
              }}
            >
              {loading ? 'Creating account...' : 'Create free account →'}
            </button>

          </form>

          <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '20px', lineHeight: '1.5' }}>
            By signing up you agree to our{' '}
            <a href="#" style={{ color: '#0F6E56' }}>Terms of Service</a>{' '}
            and{' '}
            <a href="#" style={{ color: '#0F6E56' }}>Privacy Policy</a>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginTop: '20px' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#0F6E56', fontWeight: '500' }}>Sign in</a>
        </p>

      </div>
    </div>
  )
}
