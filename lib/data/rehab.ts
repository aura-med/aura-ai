import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { asRecordArray } from '@/lib/data/records'
import { rehabSessionFromSessionDTO } from '@/lib/data/transforms'
import type { RehabPageDTO } from '@/lib/data/types'

export async function getRehabPageDTO(squadId: string | null): Promise<RehabPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return { squadId: null, sessions: [] }

  const supabase = await createClient()
  let query = supabase
    .from('rehab_sessions')
    .select(`
      id, athlete_id, start_date, current_day, rtp_criteria, clinical_data, updated_at,
      athletes!inner(
        id, name, position, club, active, squad_id,
        injury_events(injury_date, return_date, diagnosis, severity, location)
      ),
      rehab_protocols!inner(key, name, total_days, evidence, phases)
    `)
    .not('protocol_id', 'is', null)
    .eq('athletes.active', true)
    .order('updated_at', { ascending: false })

  if (squadId) query = query.eq('athletes.squad_id', squadId)

  const { data, error } = await query
  if (error) console.error('[rehab] Supabase query error:', error)

  return {
    squadId,
    sessions: asRecordArray(data).map(rehabSessionFromSessionDTO),
  }
}
