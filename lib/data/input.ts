import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canUseSquad, getViewerContext } from '@/lib/data/auth'
import { asRecordArray } from '@/lib/data/records'
import { inputAthleteDTO } from '@/lib/data/transforms'
import type { InputPageDTO } from '@/lib/data/types'

export async function getInputPageDTO(squadId: string | null): Promise<InputPageDTO> {
  const viewer = await getViewerContext()
  if (!canUseSquad(viewer, squadId)) return { squadId: null, athletes: [] }

  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select('id, name, shirt_number, position, status, availability_status, injury_events(id)')
    .eq('active', true)
    .or('availability_status.is.null,availability_status.eq.available,availability_status.eq.load_management')
    .order('shirt_number')
    .limit(2, { referencedTable: 'injury_events' })

  if (squadId) query = query.eq('squad_id', squadId)

  const { data } = await query
  return {
    squadId,
    athletes: asRecordArray(data).map(inputAthleteDTO).filter((athlete) => athlete.id),
  }
}
