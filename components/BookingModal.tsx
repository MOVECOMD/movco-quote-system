'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

interface BookingModalProps {
  quoteId: string;
  quoteData?: {
    starting_address?: string;
    ending_address?: string;
    estimate?: number;
    volume_m3?: number;
    van_count?: number;
    van_description?: string;
    recommended_movers?: number;
    distance_miles?: number;
  };
  onClose: () => void;
}

export default function BookingModal({ quoteId, quoteData, onClose }: BookingModalProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();

  const handleYes = async () => {
    setSaving(true);
    try {
      // 1. Update Supabase
      const { error } = await supabase
        .from('instant_quotes')
        .update({ interested_in_booking: true })
        .eq('id', quoteId);

      if (error) {
        console.error('Failed to save booking interest:', error.message);
      }

      // 2. Send email notification via backend
      try {
        await fetch('https://movco-api.onrender.com/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quote_id: quoteId,
            starting_address: quoteData?.starting_address || '',
            ending_address: quoteData?.ending_address || '',
            estimate: quoteData?.estimate,
            volume_m3: quoteData?.volume_m3,
            van_count: quoteData?.van_count,
            van_description: quoteData?.van_description,
            recommended_movers: quoteData?.recommended_movers,
            distance_miles: quoteData?.distance_miles,
            customer_email: user?.email || null,
            customer_name: user?.user_metadata?.full_name || null,
          }),
        });
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr);
        // Don't block the user - booking interest is already saved
      }

      setSaved(true);
    } catch (err) {
      console.error('Booking interest error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNo = async () => {
    try {
      await supabase
        .from('instant_quotes')
        .update({ interested_in_booking: false })
        .eq('id', quoteId);
    } catch (err) {
      console.error('Booking interest error:', err);
    }
    onClose();
  };

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-green-100">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">We&apos;ve got your interest!</h3>
          <p className="text-sm text-slate-600 mb-6">
            A recommended removals company in your area will be in touch soon with availability and next steps.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Continue to Quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-14 h-14 mx-auto mb-5 rounded-full bg-blue-100">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h2m6 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 text-center mb-2">
          Book a Removal Company
        </h3>
        <p className="text-sm text-slate-600 text-center mb-6">
          Would you like to go forward with a recommended removals company in your area?
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleNo}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            No thanks
          </button>
          <button
            onClick={handleYes}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Yes, find a company'}
          </button>
        </div>
      </div>
    </div>
  );
}
