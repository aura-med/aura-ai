import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { calendarPageDTO } from '@/lib/data/transforms'
import type { CalendarPageDTO } from '@/lib/data/types'

export async function getCalendarPageDTO(squadId: string | null): Promise<CalendarPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return calendarPageDTO(null, [], [])

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  let athleteQuery = supabase
    .from('athletes')
    .select('id, name, shirt_number, position, wellness_checkins(checkin_date, fatigue, sleep_hours, tqr), injury_events(id), fatigue_profiles(recovery_speed, congestion_sensitivity, typical_md1_drop, typical_md2_drop)')
    .eq('active', true)
    .or('availability_status.is.null,availability_status.eq.available,availability_status.eq.load_management')
    .order('shirt_number')
    .order('checkin_date', { referencedTable: 'wellness_checkins', ascending: false })
    .limit(1, { referencedTable: 'wellness_checkins' })
    .limit(2, { referencedTable: 'injury_events' })
    .limit(1, { referencedTable: 'fatigue_profiles' })
  let eventQuery = supabase
    .from('calendar_events')
    .select('id, squad_id, event_date, event_type, intensity, label, created_at')
    .gte('event_date', today)
    .order('event_date')
    .limit(60)

  if (squadId) {
    athleteQuery = athleteQuery.eq('squad_id', squadId)
    eventQuery = eventQuery.eq('squad_id', squadId)
  }

  const [{ data: athletes }, { data: events }] = await Promise.all([athleteQuery, eventQuery])
  return calendarPageDTO(squadId, athletes, events)
}
