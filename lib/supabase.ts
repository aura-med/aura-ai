import { createClient as createBrowserClient } from '@/lib/supabase/client'

export const supabase = createBrowserClient()

// ─── Typed query helpers ─────────────────────────────────────────

export async function getAthletes(squadId?: string) {
  let q = supabase
    .from('athletes')
    .select(`
      *,
      squads ( id, name, type ),
      wellness_checkins ( * ),
      performance_data ( * ),
      injury_events ( * ),
      rehab_sessions ( *, rehab_protocols(*) ),
      fatigue_profiles ( * ),
      athlete_passport ( * ),
      score_history ( * )
    `)
    .eq('active', true)
    .order('shirt_number', { ascending: true })

  if (squadId) q = q.eq('squad_id', squadId)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getAthlete(id: string) {
  const { data, error } = await supabase
    .from('athletes')
    .select(`
      *,
      squads ( * ),
      wellness_checkins ( * ),
      performance_data ( * ),
      injury_events ( * ),
      rehab_sessions ( *, rehab_protocols(*) ),
      fatigue_profiles ( * ),
      athlete_passport ( * ),
      score_history ( * )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function getModelWeights() {
  const { data, error } = await supabase
    .from('model_weights')
    .select('*')
    .eq('version', 1)
  if (error) throw error
  return data ?? []
}

export async function getSquads(orgId?: string) {
  let q = supabase.from('squads').select('*')
  if (orgId) q = q.eq('org_id', orgId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getOrganizations() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getSquadsByOrg(orgId: string) {
  const { data, error } = await supabase
    .from('squads')
    .select('id, name, type, season, org_id')
    .eq('org_id', orgId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getUserOrganizationContext() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) return { org: null, squads: [] }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (profileError) throw profileError
  if (!profile?.org_id) return { org: null, squads: [] }

  const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, type')
      .eq('id', profile.org_id)
      .single()

  if (orgError) throw orgError

  const { data: squads, error: squadsError } = await supabase
      .from('squads')
      .select('id, name, type, season, org_id')
      .eq('org_id', profile.org_id)
      .order('name')

  if (squadsError) {
    console.warn('[aura] Could not load squads for organization', squadsError.message)
    return { org, squads: [] }
  }

  return { org, squads: squads ?? [] }
}

export async function getAllSquads() {
  const { data, error } = await supabase
    .from('squads')
    .select('id, name, type, season, org_id, organizations(name)')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function getCalendarEvents(squadId: string) {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('squad_id', squadId)
    .order('event_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getRehabProtocols() {
  const { data, error } = await supabase
    .from('rehab_protocols')
    .select('*')
  if (error) throw error
  return data ?? []
}

export async function upsertWellnessCheckin(checkin: {
  athlete_id: string
  checkin_date: string
  checkin_type: 'morning' | 'post_session'
  fatigue?: number
  sleep_quality?: number
  sleep_hours?: number
  stress?: number
  tqr?: number
  hrv_ms?: number
  rpe?: number
}) {
  const { data, error } = await supabase
    .from('wellness_checkins')
    .upsert(checkin, { onConflict: 'athlete_id,checkin_date' })
    .select()
  if (error) throw error
  return data
}

export async function updateRehabClinical(
  sessionId: string,
  clinical_data: Record<string, unknown>
) {
  const { error } = await supabase
    .from('rehab_sessions')
    .update({ clinical_data, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function updateRtpCriteria(
  sessionId: string,
  rtp_criteria: Array<{ label: string; done: boolean }>
) {
  const { error } = await supabase
    .from('rehab_sessions')
    .update({ rtp_criteria, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function insertAthleteScore(score: {
  athlete_id: string
  score_date: string
  total_score: number
  confidence: string
  acwr_partial?: number
  hrv_partial?: number
  fatigue_partial?: number
  sleep_partial?: number
  tqr_partial?: number
  history_partial?: number
  stress_partial?: number
  decel_partial?: number
  days_since_match?: number
}) {
  const { error } = await supabase
    .from('score_history')
    .upsert(score, { onConflict: 'athlete_id,score_date' })
  if (error) throw error
}

export async function updateAthletePassport(
  athleteId: string,
  passport_data: Record<string, unknown>,
  is_shareable: boolean
) {
  const { error } = await supabase
    .from('athlete_passport')
    .upsert({ athlete_id: athleteId, passport_data, is_shareable, last_updated: new Date().toISOString() })
  if (error) throw error
}
