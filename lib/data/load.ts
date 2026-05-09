import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { asNumber, asRecord, asRecordArray, asString } from '@/lib/data/records'
import type { LoadPageDTO } from '@/lib/data/types'

export async function getLoadPageDTO(squadId: string | null): Promise<LoadPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return { squadId: null, rows: [] }

  const supabase = await createClient()
  let query = supabase
    .from('gps_sessions')
    .select('session_type, total_distance_m, hsr_distance_m, sprint_distance_m, decel_high_count, max_speed_kmh, player_load, athletes!inner(id, name, position, shirt_number, squad_id)')
    .order('session_date', { ascending: false })
    .limit(100)

  if (squadId) query = query.eq('athletes.squad_id', squadId)

  const { data } = await query
  const byAthlete = new Map<string, LoadPageDTO['rows'][number]>()

  for (const row of asRecordArray(data)) {
    const athlete = asRecord(row.athletes)
    const id = asString(athlete.id)
    if (!id || byAthlete.has(id)) continue
    byAthlete.set(id, {
      athlete: {
        id,
        name: asString(athlete.name) ?? 'Atleta',
        position: asString(athlete.position),
        shirtNumber: asNumber(athlete.shirt_number),
      },
      latest: {
        sessionType: asString(row.session_type),
        totalDistanceM: asNumber(row.total_distance_m),
        hsrDistanceM: asNumber(row.hsr_distance_m),
        sprintDistanceM: asNumber(row.sprint_distance_m),
        maxSpeedKmh: asNumber(row.max_speed_kmh),
        decelHighCount: asNumber(row.decel_high_count),
        playerLoad: asNumber(row.player_load),
      },
    })
  }

  return {
    squadId,
    rows: [...byAthlete.values()].sort((a, b) => (a.athlete.shirtNumber ?? 99) - (b.athlete.shirtNumber ?? 99)),
  }
}
