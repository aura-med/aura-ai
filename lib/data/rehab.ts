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
  let query = supabase
    .from('athletes')
    .select('id, name, position, club, rehab_sessions(id, current_day, rtp_criteria, clinical_data, rehab_protocols(key, name, total_days, evidence, phases))')
    .eq('active', true)
    .eq('availability_status', 'rtp')
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
