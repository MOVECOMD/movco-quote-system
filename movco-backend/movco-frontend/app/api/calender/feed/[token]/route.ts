// app/api/calendar/feed/[token]/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find company by token
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('id, company_name, calendar_feed_enabled')
    .eq('calendar_feed_token', token)
    .maybeSingle();

  if (companyErr || !company || !company.calendar_feed_enabled) {
    return new NextResponse('Calendar feed not found or disabled', { status: 404 });
  }

  // Fetch diary events: past 30 days to next 90 days
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 30);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 90);

  const { data: events } = await supabase
    .from('crm_diary_events')
    .select('*')
    .eq('company_id', company.id)
    .gte('start_time', pastDate.toISOString())
    .lte('start_time', futureDate.toISOString())
    .order('start_time');

  // Build iCalendar
  const companyName = company.company_name || 'MOVCO';
  const now = formatIcalDate(new Date());

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//MOVCO//${companyName}//EN`,
    `X-WR-CALNAME:${escapeIcal(companyName)} - MOVCO`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  if (events && events.length > 0) {
    for (const event of events) {
      const start = new Date(event.start_time);
      const end = event.end_time ? new Date(event.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
      const uid = `${event.id}@movco.co.uk`;

      const typeLabel = event.event_type
        ? event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)
        : 'Event';
      const summary = event.customer_name
        ? `${typeLabel}: ${event.customer_name}`
        : event.title || typeLabel;

      const descParts: string[] = [];
      if (event.title) descParts.push(event.title);
      if (event.description) descParts.push(event.description);
      if (event.customer_name) descParts.push(`Customer: ${event.customer_name}`);
      if (event.event_type) descParts.push(`Type: ${typeLabel}`);
      if (event.completed) descParts.push('Status: Completed');

      ical.push('BEGIN:VEVENT');
      ical.push(`UID:${uid}`);
      ical.push(`DTSTAMP:${now}`);
      ical.push(`DTSTART:${formatIcalDate(start)}`);
      ical.push(`DTEND:${formatIcalDate(end)}`);
      ical.push(`SUMMARY:${escapeIcal(summary)}`);

      if (event.location) {
        ical.push(`LOCATION:${escapeIcal(event.location)}`);
      }

      if (descParts.length > 0) {
        ical.push(`DESCRIPTION:${escapeIcal(descParts.join(' | '))}`);
      }

      if (event.completed) {
        ical.push('STATUS:COMPLETED');
      } else {
        ical.push('STATUS:CONFIRMED');
      }

      ical.push('END:VEVENT');
    }
  }

  ical.push('END:VCALENDAR');

  return new NextResponse(ical.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_calendar.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}