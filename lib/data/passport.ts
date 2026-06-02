import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { asRecordArray } from '@/lib/data/records'
import { passportAthleteDTO } from '@/lib/data/transforms'
import type { PassportPageDTO } from '@/lib/data/types'

export async function getPassportPageDTO(
  squadId: string | null,
  athleteId: string | null
): Promise<PassportPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return { squadId: null, selectedAthleteId: null, athletes: [] }

  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select('id, name, shirt_number, position, club, injury_events(id, injury_date, diagnosis, days_absent, return_date), performance_data(session_date, vmax), athlete_passport(passport_data, is_shareable), fatigue_profiles(recovery_speed, congestion_sensitivity)')
    .eq('active', true)
    .order('shirt_number')
    .order('injury_date', { referencedTable: 'injury_events', ascending: false })
    .order('session_date', { referencedTable: 'performance_data', ascending: false })
    .limit(50, { referencedTable: 'injury_events' })
    .limit(1, { referencedTable: 'performance_data' })
    .limit(1, { referencedTable: 'athlete_passport' })
    .limit(1, { referencedTable: 'fatigue_profiles' })

  if (squadId) query = query.eq('squad_id', squadId)

  const { data } = await query
  const athletes = asRecordArray(data).map(passportAthleteDTO).filter((athlete) => athlete.id)
  const selectedAthleteId = athletes.some((athlete) => athlete.id === athleteId)
    ? athleteId
    : athletes[0]?.id ?? null

  return { squadId, selectedAthleteId, athletes }
}
