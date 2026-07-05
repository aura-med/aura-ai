import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface RehabSessionDTO {
  id: string
  athlete_id: string
  protocol_id: string | null
  phase_index: number
  start_date: string
  clinical_data: Record<string, unknown> | null
  rtp_criteria: Array<{ label: string; done: boolean }> | null
  updated_at: string
  athletes: {
    id: string
    name: string
    shirt_number: number | null
    position: string | null
    status: string
  }
  rehab_protocols: {
    id: string
    name: string
    phases: unknown
  } | null
}

export async function getRehabSessions(squadId?: string | null): Promise<RehabSessionDTO[]> {
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, position, status,
      rehab_sessions (
        id, athlete_id, protocol_id, phase_index, start_date, clinical_data, rtp_criteria, updated_at,
        rehab_protocols ( id, name, phases )
      )
    `)
    .eq('active', true)
    .eq('availability_status', 'rtp')
  if (squadId) query = query.eq('squad_id', squadId)
  const { data, error } = await query
  if (error) throw error

  type RawAthlete = {
    id: string
    name: string
    shirt_number: number | null
    position: string | null
    status: string
    rehab_sessions: Array<{
      id: string
      athlete_id: string
      protocol_id: string | null
      phase_index: number
      start_date: string
      clinical_data: Record<string, unknown> | null
      rtp_criteria: Array<{ label: string; done: boolean }> | null
      updated_at: string
      rehab_protocols: RehabSessionDTO['rehab_protocols']
    }>
  }
  const athletes = (data ?? []) as unknown as RawAthlete[]

  // Flatten: one entry per athlete
  return athletes.map((a) => {
    const session = a.rehab_sessions?.[0] ?? null
    if (session) {
      return {
        ...session,
        athletes: {
          id: a.id,
          name: a.name,
          shirt_number: a.shirt_number,
          position: a.position,
          status: a.status,
        },
        rehab_protocols: session.rehab_protocols,
      } as RehabSessionDTO
    }
    return {
      id: `no-session-${a.id}`,
      athlete_id: a.id,
      protocol_id: null,
      phase_index: 0,
      start_date: '',
      clinical_data: null,
      rtp_criteria: null,
      updated_at: '',
      athletes: {
        id: a.id,
        name: a.name,
        shirt_number: a.shirt_number,
        position: a.position,
        status: a.status,
      },
      rehab_protocols: null,
    } as RehabSessionDTO & { noSession: true }
  })
}
