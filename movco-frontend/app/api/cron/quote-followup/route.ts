import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getFollowUpEmail1, getFollowUpEmail2 } from '@/lib/email-templates';

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const QUOTE_SYSTEM_URL = 'https://movco-quote-system.vercel.app';
const FROM_EMAIL = 'MOVCO <quotes@movco.co.uk>';

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let emailsSent = 0;
    let errors: string[] = [];

    // =====================================================
    // EMAIL 1: Send 2 hours after quote, if not interested
    // =====================================================
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    // Find quotes created 2+ hours ago that:
    // - Have NOT expressed interest in booking
    // - Have NOT been sent follow-up email 1
    // - Have a user_id (so we can look up their email)
    const { data: email1Quotes, error: email1Error } = await supabase
      .from('instant_quotes')
      .select('id, user_id, ai_analysis, created_at, starting_address, ending_address')
      .is('interested_in_booking', null)
      .is('followup_email_1_sent', null)
      .not('user_id', 'is', null)
      .lte('created_at', twoHoursAgo)
      .limit(20);

    if (email1Error) {
      errors.push(`Email 1 query error: ${email1Error.message}`);
    }

    if (email1Quotes && email1Quotes.length > 0) {
      for (const quote of email1Quotes) {
        try {
          // Get user profile for name and email
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', quote.user_id)
            .single();

          // Also get email from auth if profile doesn't have it
          let userEmail = profile?.email;
          if (!userEmail) {
            const { data: authUser } = await supabase.auth.admin.getUserById(quote.user_id);
            userEmail = authUser?.user?.email;
          }

          if (!userEmail) {
            console.log(`No email found for user ${quote.user_id}, skipping`);
            continue;
          }

          // Extract estimate from AI analysis
          let estimatedQuote = 'your estimate';
          if (quote.ai_analysis?.estimated_cost) {
            estimatedQuote = `£${quote.ai_analysis.estimated_cost.toLocaleString()}`;
          } else if (quote.ai_analysis?.items) {
            // Calculate from items if no top-level estimate
            let totalFt3 = 0;
            for (const item of quote.ai_analysis.items) {
              const match = (item.note || '').match(/([\d.]+)\s*ft/i);
              if (match) totalFt3 += parseFloat(match[1]) * (item.quantity || 1);
            }
            if (totalFt3 > 0) {
              const volumeM3 = Math.round(totalFt3 * 0.0283168 * 10) / 10;
              estimatedQuote = `${volumeM3} m³ of belongings`;
            }
          }

          const quoteLink = `${QUOTE_SYSTEM_URL}/dashboard/${quote.id}`;
          const customerName = profile?.full_name || '';

          const emailContent = getFollowUpEmail1(customerName, estimatedQuote, quoteLink);

          const { error: sendError } = await resend.emails.send({
            from: FROM_EMAIL,
            to: userEmail,
            subject: emailContent.subject,
            html: emailContent.html,
          });

          if (sendError) {
            errors.push(`Failed to send email 1 to ${userEmail}: ${sendError.message}`);
            continue;
          }

          // Mark as sent
          await supabase
            .from('instant_quotes')
            .update({ followup_email_1_sent: new Date().toISOString() })
            .eq('id', quote.id);

          emailsSent++;
          console.log(`Follow-up email 1 sent to ${userEmail} for quote ${quote.id}`);
        } catch (err: any) {
          errors.push(`Email 1 error for quote ${quote.id}: ${err.message}`);
        }
      }
    }

    // =====================================================
    // EMAIL 2: Send 48 hours after quote, if still not interested
    // =====================================================
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Find quotes created 48+ hours ago that:
    // - Have NOT expressed interest in booking
    // - HAVE been sent follow-up email 1
    // - Have NOT been sent follow-up email 2
    const { data: email2Quotes, error: email2Error } = await supabase
      .from('instant_quotes')
      .select('id, user_id, ai_analysis, created_at, starting_address, ending_address')
      .is('interested_in_booking', null)
      .not('followup_email_1_sent', 'is', null)
      .is('followup_email_2_sent', null)
      .not('user_id', 'is', null)
      .lte('created_at', fortyEightHoursAgo)
      .limit(20);

    if (email2Error) {
      errors.push(`Email 2 query error: ${email2Error.message}`);
    }

    if (email2Quotes && email2Quotes.length > 0) {
      for (const quote of email2Quotes) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', quote.user_id)
            .single();

          let userEmail = profile?.email;
          if (!userEmail) {
            const { data: authUser } = await supabase.auth.admin.getUserById(quote.user_id);
            userEmail = authUser?.user?.email;
          }

          if (!userEmail) continue;

          let estimatedQuote = 'your estimate';
          if (quote.ai_analysis?.estimated_cost) {
            estimatedQuote = `£${quote.ai_analysis.estimated_cost.toLocaleString()}`;
          } else if (quote.ai_analysis?.items) {
            let totalFt3 = 0;
            for (const item of quote.ai_analysis.items) {
              const match = (item.note || '').match(/([\d.]+)\s*ft/i);
              if (match) totalFt3 += parseFloat(match[1]) * (item.quantity || 1);
            }
            if (totalFt3 > 0) {
              const volumeM3 = Math.round(totalFt3 * 0.0283168 * 10) / 10;
              estimatedQuote = `${volumeM3} m³ of belongings`;
            }
          }

          const quoteLink = `${QUOTE_SYSTEM_URL}/dashboard/${quote.id}`;
          const customerName = profile?.full_name || '';

          const emailContent = getFollowUpEmail2(customerName, estimatedQuote, quoteLink);

          const { error: sendError } = await resend.emails.send({
            from: FROM_EMAIL,
            to: userEmail,
            subject: emailContent.subject,
            html: emailContent.html,
          });

          if (sendError) {
            errors.push(`Failed to send email 2 to ${userEmail}: ${sendError.message}`);
            continue;
          }

          await supabase
            .from('instant_quotes')
            .update({ followup_email_2_sent: new Date().toISOString() })
            .eq('id', quote.id);

          emailsSent++;
          console.log(`Follow-up email 2 sent to ${userEmail} for quote ${quote.id}`);
        } catch (err: any) {
          errors.push(`Email 2 error for quote ${quote.id}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      emails_sent: emailsSent,
      email1_candidates: email1Quotes?.length || 0,
      email2_candidates: email2Quotes?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Cron job error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}