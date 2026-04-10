import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Default working hours if none configured
const DEFAULT_HOURS: Record<string, { start: string; end: string } | null> = {
  monday:    { start: '09:00', end: '17:00' },
  tuesday:   { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday:  { start: '09:00', end: '17:00' },
  friday:    { start: '09:00', end: '17:00' },
  saturday:  null,
  sunday:    null,
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Slot duration in minutes
const SLOT_DURATION = 60
// Buffer between slots in minutes
const SLOT_BUFFER = 0
// How many days ahead to show availability
const MAX_DAYS_AHEAD = 30
// Minimum hours notice required for booking
const MIN_NOTICE_HOURS = 4

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('company_id')
    const dateStr = searchParams.get('date') // Optional: specific date YYYY-MM-DD

    if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    // Load working hours config
    const { data: config } = await supabase
      .from('company_config')
      .select('working_hours')
      .eq('company_id', companyId)
      .maybeSingle()

    const workingHours = config?.working_hours || DEFAULT_HOURS

    // Load blocked dates / holidays (if you add this table later)
    // const { data: blocked } = await supabase.from('blocked_dates').select('date').eq('company_id', companyId)

    const now = new Date()
    const minBookingTime = new Date(now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000)

    if (dateStr) {
      // Return slots for a specific date
      const slots = await getSlotsForDate(companyId, dateStr, workingHours, minBookingTime)
      return NextResponse.json({ date: dateStr, slots })
    }

    // Return available dates for the next MAX_DAYS_AHEAD days
    const availableDates: { date: string; day: string; slots_count: number }[] = []

    for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const ds = d.toISOString().split('T')[0]
      const dayName = DAY_NAMES[d.getDay()]
      const dayHours = workingHours[dayName]

      // Skip non-working days
      if (!dayHours || !dayHours.start || !dayHours.end) continue

      // Count available slots for this day
      const slots = await getSlotsForDate(companyId, ds, workingHours, minBookingTime)
      if (slots.length > 0) {
        availableDates.push({
          date: ds,
          day: dayName,
          slots_count: slots.length,
        })
      }
    }

    return NextResponse.json({
      available_dates: availableDates,
      slot_duration_minutes: SLOT_DURATION,
      max_days_ahead: MAX_DAYS_AHEAD,
      min_notice_hours: MIN_NOTICE_HOURS,
    })
  } catch (err: any) {
    console.error('Availability error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

async function getSlotsForDate(
  companyId: string,
  dateStr: string,
  workingHours: Record<string, any>,
  minBookingTime: Date
): Promise<{ time: string; available: boolean }[]> {
  const date = new Date(dateStr + 'T00:00:00')
  const dayName = DAY_NAMES[date.getDay()]
  const dayHours = workingHours[dayName]

  if (!dayHours || !dayHours.start || !dayHours.end) return []

  // Parse start/end hours
  const [startH, startM] = dayHours.start.split(':').map(Number)
  const [endH, endM] = dayHours.end.split(':').map(Number)

  // Load existing events for this date
  const dayStart = `${dateStr}T00:00:00`
  const dayEnd = `${dateStr}T23:59:59`

  const { data: events } = await supabase
    .from('crm_diary_events')
    .select('start_time, end_time, title')
    .eq('company_id', companyId)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .order('start_time')

  const bookedSlots = (events || []).map(e => ({
    start: new Date(e.start_time),
    end: e.end_time ? new Date(e.end_time) : new Date(new Date(e.start_time).getTime() + SLOT_DURATION * 60000),
  }))

  // Generate time slots
  const slots: { time: string; available: boolean }[] = []
  let current = new Date(date)
  current.setHours(startH, startM, 0, 0)

  const endTime = new Date(date)
  endTime.setHours(endH, endM, 0, 0)

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + SLOT_DURATION * 60000)
    const timeStr = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`

    // Check if slot is in the past (or within minimum notice)
    const isPast = current <= minBookingTime

    // Check if slot overlaps with any existing event
    const isBooked = bookedSlots.some(booked =>
      (current >= booked.start && current < booked.end) ||
      (slotEnd > booked.start && slotEnd <= booked.end) ||
      (current <= booked.start && slotEnd >= booked.end)
    )

    if (!isPast && !isBooked) {
      slots.push({ time: timeStr, available: true })
    }

    // Move to next slot
    current = new Date(current.getTime() + (SLOT_DURATION + SLOT_BUFFER) * 60000)
  }

  return slots
}