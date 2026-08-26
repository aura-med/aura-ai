import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { asRecordArray } from '@/lib/data/records'
import { rehabSessionDTO } from '@/lib/data/transforms'
import type { RehabPageDTO } from '@/lib/data/types'

export async function getRehabPageDTO(squadId: string | null): Promise<RehabPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return { squadId: null, sessions: [] }

  const supabase = await createClient()
  // Select by the rehab-session relationship (inner join), not the athlete's
  // exclusive display status: an athlete in active rehab can be floored to
  // 'unavailable' by a concurrent open occurrence/diagnosis (more restrictive
  // than the RTP floor) and would otherwise drop off the rehab roster, hiding
  // their protocol controls from clinicians.
  let query = supabase
    .from('athletes')
    .select('id, name, position, club, rehab_sessions!inner(id, current_day, rtp_criteria, clinical_data, rehab_protocols(key, name, total_days, evidence, phases))')
    .eq('active', true)
    .order('shirt_number')
    .order('updated_at', { referencedTable: 'rehab_sessions', ascending: false })
    .limit(1, { referencedTable: 'rehab_sessions' })

  if (squadId) query = query.eq('squad_id', squadId)

  const { data, error } = await query
  if (error) console.error('[rehab] Supabase query error:', error)
  return {
    squadId,
    sessions: asRecordArray(data).map(rehabSessionDTO),
  }
}
