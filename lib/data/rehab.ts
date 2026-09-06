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
    // rehab_sessions is shared, by name only, with the unrelated physio/
    // rehab session log (008/027/033/035/074) — without this, an ordinary
    // treatment log row (protocol_id IS NULL, never populating
    // current_day/rtp_criteria/clinical_data/rehab_protocols) could be the
    // "latest" row selected below, rendering as a broken/empty RTP
    // protocol card for an athlete who was never actually on one.
    .not('rehab_sessions.protocol_id', 'is', null)
    .order('shirt_number')
    .order('updated_at', { referencedTable: 'rehab_sessions', ascending: false })
    .limit(1, { referencedTable: 'rehab_sessions' })
    .limit(1, { referencedTable: 'rehab_protocols' })

  if (squadId) query = query.eq('squad_id', squadId)

  const { data } = await query
  return {
    squadId,
    sessions: asRecordArray(data).map(rehabSessionDTO),
  }
}
