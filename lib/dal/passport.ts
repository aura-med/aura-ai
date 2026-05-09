import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface PassportAthleteDTO {
  id: string
  name: string
  shirt_number: number | null
  position: string | null
  status: string
  squad_id: string | null
  injury_events: Array<{
    id: string
    injury_date: string
    return_date: string | null
    diagnosis: string | null
    location: string | null
    severity: string | null
    days_absent: number | null
    is_recurrence: boolean
  }>
  performance_data: Array<{
    session_date: string
    vmax: number | null
    vmax_today_pct: number | null
  }>
  athlete_passport: Array<{
    id: string
    passport_data: unknown
    is_shareable: boolean
    last_updated: string | null
  }>
  fatigue_profiles: Array<{
    id: string
    avg_daily_load: number | null
    peak_load: number | null
    load_tolerance: string | null
  }>
}

export async function getPassportList(squadId?: string | null): Promise<PassportAthleteDTO[]> {
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, position, status, squad_id,
      injury_events ( id, injury_date, return_date, diagnosis, location, severity, days_absent, is_recurrence ),
      performance_data ( session_date, vmax, vmax_today_pct ),
      athlete_passport ( id, passport_data, is_shareable, last_updated ),
      fatigue_profiles ( id, avg_daily_load, peak_load, load_tolerance )
    `)
    .eq('active', true)
    .order('shirt_number')
  if (squadId) query = query.eq('squad_id', squadId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PassportAthleteDTO[]
}
