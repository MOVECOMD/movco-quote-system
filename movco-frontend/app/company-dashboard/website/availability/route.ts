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

const MAX_DAYS_AHEAD = 30
const MIN_NOTICE_HOURS = 4

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('company_id')
    const dateStr = searchParams.get('date') // Optional: specific date YYYY-MM-DD
    const eventTypeSlug = searchParams.get('event_type') // Optional: specific event type slug

    if (!companyId) return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })

    // Load working hours config
    const { data: config } = await supabase
      .from('company_config')
      .select('working_hours, custom_event_types')
      .eq('company_id', companyId)
      .maybeSingle()

    const workingHours = config?.working_hours || DEFAULT_HOURS
    const eventTypes = config?.custom_event_types || []

    // ═══ Event type specific rules ═══
    let slotDuration = 60 // default
    let typeAvailableDays: string[] | null = null // null = use working hours
    let typeAvailableHours: { start: string; end: string } | null = null // null = use working hours
    let eventTypeLabel = 'Consultation'

    if (eventTypeSlug) {
      const eventType = eventTypes.find((t: any) =>
        t.slug === eventTypeSlug || t.key === eventTypeSlug
      )
      if (eventType) {
        slotDuration = eventType.duration_minutes || 60
        eventTypeLabel = eventType.label || eventTypeSlug
        if (eventType.available_days && eventType.available_days.length > 0) {
          typeAvailableDays = eventType.available_days.map((d: string) => d.toLowerCase())
        }
        if (eventType.available_hours) {
          typeAvailableHours = eventType.available_hours
        }
      } else {
        return NextResponse.json({ error: 'Event type not found' }, { status: 404 })
      }
    }

    const now = new Date()
    const minBookingTime = new Date(now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000)

    if (dateStr) {
      const slots = await getSlotsForDate(companyId, dateStr, workingHours, minBookingTime, slotDuration, typeAvailableDays, typeAvailableHours)
      return NextResponse.json({ date: dateStr, slots, duration_minutes: slotDuration, event_type: eventTypeLabel })
    }

    // Return available dates for the next MAX_DAYS_AHEAD days
    const availableDates: { date: string; day: string; slots_count: number }[] = []

    for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const ds = d.toISOString().split('T')[0]
      const dayName = DAY_NAMES[d.getDay()]

      // Check event-type-specific day restrictions
      if (typeAvailableDays && !typeAvailableDays.includes(dayName)) continue

      // Check working hours for this day
      const dayHours = workingHours[dayName]
      if (!dayHours || !dayHours.start || !dayHours.end) continue

      const slots = await getSlotsForDate(companyId, ds, workingHours, minBookingTime, slotDuration, typeAvailableDays, typeAvailableHours)
      if (slots.length > 0) {
        availableDates.push({ date: ds, day: dayName, slots_count: slots.length })
      }
    }

    return NextResponse.json({
      available_dates: availableDates,
      slot_duration_minutes: slotDuration,
      event_type: eventTypeLabel,
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
  minBookingTime: Date,
  slotDuration: number,
  typeAvailableDays: string[] | null,
  typeAvailableHours: { start: string; end: string } | null,
): Promise<{ time: string; available: boolean }[]> {
  const date = new Date(dateStr + 'T00:00:00')
  const dayName = DAY_NAMES[date.getDay()]

  // Check day restrictions
  if (typeAvailableDays && !typeAvailableDays.includes(dayName)) return []

  const dayHours = workingHours[dayName]
  if (!dayHours || !dayHours.start || !dayHours.end) return []

  // Use event-type-specific hours if set, otherwise use working hours
  const effectiveHours = typeAvailableHours || dayHours
  const [startH, startM] = effectiveHours.start.split(':').map(Number)
  const [endH, endM] = effectiveHours.end.split(':').map(Number)

  // Load existing events for this date
  const dayStart = `${dateStr}T00:00:00`
  const dayEnd = `${dateStr}T23:59:59`

  const { data: events } = await supabase
    .from('crm_diary_events')
    .select('start_time, end_time')
    .eq('company_id', companyId)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .order('start_time')

  const bookedSlots = (events || []).map(e => ({
    start: new Date(e.start_time),
    end: e.end_time ? new Date(e.end_time) : new Date(new Date(e.start_time).getTime() + 60 * 60000),
  }))

  const slots: { time: string; available: boolean }[] = []
  let current = new Date(date)
  current.setHours(startH, startM, 0, 0)

  const endTime = new Date(date)
  endTime.setHours(endH, endM, 0, 0)

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60000)

    // Don't offer slots that would run past end time
    if (slotEnd > endTime) break

    const timeStr = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
    const isPast = current <= minBookingTime
    const isBooked = bookedSlots.some(booked =>
      (current >= booked.start && current < booked.end) ||
      (slotEnd > booked.start && slotEnd <= booked.end) ||
      (current <= booked.start && slotEnd >= booked.end)
    )

    if (!isPast && !isBooked) {
      slots.push({ time: timeStr, available: true })
    }

    current = new Date(current.getTime() + slotDuration * 60000)
  }

  return slots
}