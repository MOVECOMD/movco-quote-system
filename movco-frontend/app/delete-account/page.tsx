'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function DeleteAccountPage() {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const contactEmail = user?.email || email;
    if (!contactEmail) return;

    // Send deletion request email via mailto (simple approach)
    window.location.href = `mailto:zachary@movco.co.uk?subject=Account%20Deletion%20Request&body=I%20would%20like%20to%20request%20the%20deletion%20of%20my%20MOVCO%20account%20and%20all%20associated%20data.%0A%0AAccount%20email%3A%20${encodeURIComponent(contactEmail)}%0A%0AThank%20you.`;
    
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Deletion Request Submitted</h1>
          <p className="text-slate-600">
            Your account deletion request has been sent. We will process your request within 30 days 
            and send you a confirmation email once your account and all associated data have been permanently deleted.
          </p>
          <p className="text-slate-500 text-sm mt-4">
            If your email client did not open, please send your request directly to{' '}
            <a href="mailto:zachary@movco.co.uk" className="text-blue-600 underline">zachary@movco.co.uk</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Delete Your Account</h1>
        <p className="text-slate-600 mb-8">
          We&apos;re sorry to see you go. Submitting this request will permanently delete your MOVCO account 
          and all associated data, including your moving quotes, uploaded photos, and personal information.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-red-800 mb-2">What will be deleted:</h3>
          <p className="text-red-700 text-sm">
            Your account profile and login credentials; all moving quotes and AI-generated inventories; 
            all uploaded photographs; your address and contact information; payment history and quote credits; 
            and any data shared with removal companies on your behalf.
          </p>
          <p className="text-red-700 text-sm mt-2 font-semibold">
            This action is permanent and cannot be undone.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {user ? (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Logged in as:</p>
              <p className="font-medium text-slate-900">{user.email}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">
                Your account email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition text-slate-900"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Request Account Deletion
          </button>

          <p className="text-xs text-slate-500 text-center">
            Your request will be processed within 30 days in accordance with UK GDPR. 
            You will receive a confirmation email once deletion is complete.
          </p>
        </form>
      </div>
    </div>
  );
}

