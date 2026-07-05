'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type AvailabilityStatus = 'available' | 'evaluation' | 'unavailable' | 'rtp'

// Higher number = more restrictive. When an athlete has several open
// occurrences/diagnoses, the most restrictive one wins.
const STATUS_SEVERITY: Record<AvailabilityStatus, number> = {
  available: 0,
  evaluation: 1,
  rtp: 2,
  unavailable: 3,
}

// Derive an athlete's availability from all their still-open occurrences and
// diagnoses. Falls back to `fallback` when nothing else is active.
async function recomputeAthleteAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  fallback: AvailabilityStatus
): Promise<AvailabilityStatus> {
  const [{ data: occ }, { data: diag }, { data: athlete }] = await Promise.all([
    supabase
      .from('occurrences')
      .select('availability_status')
      .eq('athlete_id', athleteId)
      .eq('is_resolved', false),
    supabase
      .from('diagnoses')
      .select('availability_status')
      .eq('athlete_id', athleteId)
      .eq('is_resolved', false),
    supabase
      .from('athletes')
      .select('status')
      .eq('id', athleteId)
      .single(),
  ])

  const statuses = [...(occ ?? []), ...(diag ?? [])]
    .map((r) => r.availability_status as AvailabilityStatus | null)
    .filter((s): s is AvailabilityStatus => s != null && s in STATUS_SEVERITY)

  // The legacy rehab flag keeps the athlete in RTP as a floor: resolving a
  // less-restrictive issue must not pull an athlete out of active rehab.
  if (athlete?.status === 'rehab') statuses.push('rtp')

  if (statuses.length === 0) return fallback

  return statuses.reduce((worst, s) =>
    STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst
  )
}

export interface RegisterOccurrenceInput {
  athleteId: string
  orgId: string
  squadId: string | null
  microcycleNumber: number | null
  occurrenceDate: string
  occurrenceType: 'complaint' | 'trauma' | 'disease' | 'other'
  subjective: string
  objective: string
  assessment: string
  plan: string
  availabilityStatus: 'available' | 'evaluation' | 'unavailable' | 'rtp'
  clinicianName: string
  clinicianRole: string
}

// Resolve the acting clinician's audit labels from the authenticated profile,
// never from client-supplied fields (which could impersonate another clinician).
async function getClinician(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user?.id ?? '')
    .single()
  return { userId: user?.id, name: profile?.full_name ?? '', role: profile?.role ?? '' }
}

export async function registerOccurrence(input: RegisterOccurrenceInput) {
  const supabase = await createClient()
  const clinician = await getClinician(supabase)

  const { error } = await supabase.from('occurrences').insert({
    athlete_id: input.athleteId,
    org_id: input.orgId,
    squad_id: input.squadId,
    microcycle_number: input.microcycleNumber,
    occurrence_date: input.occurrenceDate,
    occurrence_type: input.occurrenceType,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    availability_status: input.availabilityStatus,
    created_by: clinician.userId,
    clinician_name: clinician.name,
    clinician_role: clinician.role,
    is_resolved: false,
  })

  if (error) throw new Error(error.message)

  // Recompute from all active issues so a less-restrictive new occurrence
  // doesn't clear a still-active unavailable/rtp one.
  const nextStatus = await recomputeAthleteAvailability(supabase, input.athleteId, input.availabilityStatus)
  await supabase.rpc('update_athlete_availability', { p_athlete_id: input.athleteId, p_status: nextStatus })

  revalidatePath('/occurrences')
  revalidatePath('/')
}

export async function resolveOccurrence(
  occurrenceId: string,
  athleteId: string,
  resolutionStatus: 'available' | 'evaluation' | 'unavailable' | 'rtp'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Trust the occurrence row's own athlete_id (returned from the update), not the
  // client-supplied athleteId, so we never recompute availability for the wrong athlete.
  const { data: resolved, error: resolveError } = await supabase
    .from('occurrences')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      availability_status: resolutionStatus,
    })
    .eq('id', occurrenceId)
    .select('athlete_id')
    .single()

  // No row updated (stale or RLS-filtered id) → nothing was resolved; abort
  // before touching availability so a crafted call can't move an athlete's state.
  if (resolveError || !resolved?.athlete_id) {
    throw new Error(resolveError?.message ?? 'Ocorrência não encontrada')
  }
  const targetAthleteId = resolved.athlete_id

  // Recompute athlete availability from the remaining open occurrences/diagnoses
  // so resolving one occurrence doesn't clear a still-active injury elsewhere.
  // This occurrence is now resolved, so `resolutionStatus` only applies as the
  // fallback when nothing else is open.
  const nextStatus = await recomputeAthleteAvailability(supabase, targetAthleteId, resolutionStatus)
  await supabase.rpc('update_athlete_availability', { p_athlete_id: targetAthleteId, p_status: nextStatus })

  revalidatePath('/occurrences')
  revalidatePath('/')
}

export async function addOccurrenceRecord(input: {
  occurrenceId: string
  athleteId: string
  recordDate: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  availabilityStatus: 'available' | 'evaluation' | 'unavailable' | 'rtp'
}) {
  const supabase = await createClient()
  const clinician = await getClinician(supabase)

  // Reassessments only apply to a still-open occurrence. Update its status guarded
  // by is_resolved=false and abort if no row matched (already resolved / stale
  // form), so a late submit can't re-open an athlete's availability. Also gives us
  // the row's own athlete_id rather than trusting the client-supplied one.
  const { data: openOcc, error: occErr } = await supabase
    .from('occurrences')
    .update({ availability_status: input.availabilityStatus })
    .eq('id', input.occurrenceId)
    .eq('is_resolved', false)
    .select('athlete_id')
    .single()
  if (occErr || !openOcc?.athlete_id) {
    throw new Error(occErr?.message ?? 'Ocorrência já resolvida ou inexistente')
  }
  const targetAthleteId = openOcc.athlete_id

  // Abort if the record insert fails (e.g. RLS rejection) — otherwise the
  // occurrence/athlete state would change with no reassessment in the audit trail.
  const { error: recordError } = await supabase.from('occurrence_records').insert({
    occurrence_id: input.occurrenceId,
    athlete_id: targetAthleteId,
    record_date: input.recordDate,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    availability_status: input.availabilityStatus,
    created_by: clinician.userId,
    clinician_name: clinician.name,
  })
  if (recordError) throw new Error(recordError.message)

  // Recompute from all active occurrences/diagnoses so a less-restrictive
  // reassessment on one issue doesn't clear a still-active one elsewhere.
  const nextStatus = await recomputeAthleteAvailability(supabase, targetAthleteId, input.availabilityStatus)
  await supabase.rpc('update_athlete_availability', { p_athlete_id: targetAthleteId, p_status: nextStatus })

  revalidatePath('/occurrences')
  revalidatePath('/')
}
