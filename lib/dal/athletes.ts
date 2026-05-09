import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface AthleteListDTO {
  id: string
  name: string
  shirt_number: number | null
  position: string | null
  status: string
  squad_id: string | null
  wellness_checkins: Array<{
    checkin_date: string
    fatigue: number | null
    sleep_hours: number | null
    tqr: number | null
    stress: number | null
    hrv_ms: number | null
    sleep_quality: number | null
  }>
  injury_events: Array<{
    id: string
    injury_date: string
    return_date: string | null
    severity: string | null
  }>
  score_history: Array<{
    score_date: string
    total_score: number
  }>
}

export async function getAthleteList(squadId?: string | null): Promise<AthleteListDTO[]> {
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, position, status, squad_id,
      wellness_checkins ( checkin_date, fatigue, sleep_hours, tqr, stress, hrv_ms, sleep_quality ),
      injury_events ( id, injury_date, return_date, severity ),
      score_history ( score_date, total_score )
    `)
    .eq('active', true)
    .order('shirt_number')
  if (squadId) query = query.eq('squad_id', squadId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AthleteListDTO[]
}

export interface ReadinessAthleteDTO {
  id: string
  name: string
  shirt_number: number | null
  position: string | null
  status: string
  squad_id: string | null
  wellness_checkins: Array<{
    checkin_date: string
    fatigue: number | null
    sleep_hours: number | null
    tqr: number | null
    stress: number | null
    hrv_ms: number | null
  }>
  performance_data: Array<{
    session_date: string
    vmax: number | null
    vmax_today_pct: number | null
  }>
  injury_events: Array<{
    injury_date: string
    return_date: string | null
    severity: string | null
  }>
  athlete_passport: Array<{
    is_shareable: boolean
    passport_data: { hrv_baseline_ms?: number | null } | null
  }>
}

export async function getReadinessList(squadId?: string | null): Promise<ReadinessAthleteDTO[]> {
  const supabase = await createClient()
  let query = supabase
    .from('athletes')
    .select(`
      id, name, shirt_number, position, status, squad_id,
      wellness_checkins ( checkin_date, fatigue, sleep_hours, tqr, stress, hrv_ms ),
      performance_data ( session_date, vmax, vmax_today_pct ),
      injury_events ( injury_date, return_date, severity ),
      athlete_passport ( is_shareable, passport_data )
    `)
    .eq('active', true)
    .eq('status', 'available')
    .order('shirt_number')
  if (squadId) query = query.eq('squad_id', squadId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ReadinessAthleteDTO[]
}
