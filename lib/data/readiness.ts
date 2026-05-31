import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { asRecordArray } from '@/lib/data/records'
import { readinessRowDTO } from '@/lib/data/transforms'
import type { ReadinessPageDTO } from '@/lib/data/types'

export async function getReadinessPageDTO(squadId: string | null): Promise<ReadinessPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) {
    return { squadId: null, rows: [], summary: { green: 0, amber: 0, red: 0, total: 0 } }
  }

  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select(`
      id, name, position, club,
      wellness_checkins(checkin_date, fatigue, doms, sleep_hours, sleep_quality, tqr, stress, hrv_ms),
      gps_sessions(session_date, session_type),
      injury_events(id),
      athlete_passport(passport_data)
    `)
    .eq('active', true)
    .eq('status', 'available')
    .order('shirt_number')
    .order('checkin_date', { referencedTable: 'wellness_checkins', ascending: false })
    .order('session_date', { referencedTable: 'gps_sessions', ascending: false })

  if (squadId) query = query.eq('squad_id', squadId)

  const { data } = await query
  const rows = asRecordArray(data).map(readinessRowDTO).filter((row) => row.id)

  return {
    squadId,
    rows,
    summary: {
      green: rows.filter((row) => row.readiness.overall.key === 'green').length,
      amber: rows.filter((row) => row.readiness.overall.key === 'amber').length,
      red:   rows.filter((row) => row.readiness.overall.key === 'red').length,
      total: rows.length,
    },
  }
}
