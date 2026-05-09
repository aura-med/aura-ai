import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { calendarPageDTO } from '@/lib/data/transforms'
import type { CalendarPageDTO } from '@/lib/data/types'

export async function getCalendarPageDTO(squadId: string | null): Promise<CalendarPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return calendarPageDTO(null, [], [])

  const supabase = await createClient()
  let athleteQuery = supabase
    .from('athletes')
    .select('id, name, shirt_number, position, wellness_checkins(checkin_date, fatigue, sleep_hours, tqr), injury_events(id), fatigue_profiles(recovery_speed, congestion_sensitivity, typical_md1_drop, typical_md2_drop)')
    .eq('active', true)
    .eq('status', 'available')
    .order('shirt_number')
  let eventQuery = supabase
    .from('calendar_events')
    .select('id, squad_id, event_date, event_type, intensity, label, created_at')
    .order('event_date')

  if (squadId) {
    athleteQuery = athleteQuery.eq('squad_id', squadId)
    eventQuery = eventQuery.eq('squad_id', squadId)
  }

  const [{ data: athletes }, { data: events }] = await Promise.all([athleteQuery, eventQuery])
  return calendarPageDTO(squadId, athletes, events)
}
