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
  const [occResult, diagResult, rehabResult] = await Promise.all([
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
    // SECURITY DEFINER RPC — reads rehab_sessions/injury_events regardless of the
    // caller's role (masseurs have no direct SELECT on those tables).
    supabase.rpc('athlete_in_active_rehab', { p_athlete_id: athleteId }),
  ])

  // A failed read resolves as { data: null, error } rather than throwing. If we
  // ignored it, a restrictive diagnosis or active rehab could silently drop out
  // of the computation and persist a wrongly-permissive status (often
  // 'available'). Abort instead of recomputing from partial clinical data.
  const sourceError = occResult.error ?? diagResult.error ?? rehabResult.error
  if (sourceError) {
    throw new Error(`Não foi possível recalcular a disponibilidade: ${sourceError.message}`)
  }
  const occ = occResult.data
  const diag = diagResult.data
  const inActiveRehab = rehabResult.data

  const statuses = [...(occ ?? []), ...(diag ?? [])]
    .map((r) => r.availability_status as AvailabilityStatus | null)
    .filter((s): s is AvailabilityStatus => s != null && s in STATUS_SEVERITY)

  // Active rehab keeps the athlete in RTP as a floor: resolving a less-restrictive
  // issue must not pull an athlete out of rehab.
  if (inActiveRehab === true) statuses.push('rtp')

  if (statuses.length === 0) return fallback

  return statuses.reduce((worst, s) =>
    STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst
  )
}

// Persist the computed availability. The RPC resolves as { error } on a
// transient PostgREST/DB failure rather than throwing, so an unchecked call
// would leave the dashboard showing a stale status (e.g. hiding a newly
// unavailable athlete) while reporting success. Throw so the caller surfaces it.
async function persistAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  status: AvailabilityStatus,
) {
  const { error } = await supabase.rpc('update_athlete_availability', { p_athlete_id: athleteId, p_status: status })
  if (error) throw new Error(`Não foi possível atualizar a disponibilidade: ${error.message}`)
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
  await persistAvailability(supabase, input.athleteId, nextStatus)

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
  // Guard on is_resolved=false so a stale/double resolve doesn't overwrite the
  // original resolved_at/resolved_by on an already-resolved row.
  const { data: resolved, error: resolveError } = await supabase
    .from('occurrences')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      availability_status: resolutionStatus,
    })
    .eq('id', occurrenceId)
    .eq('is_resolved', false)
    .select('athlete_id')
    .maybeSingle()

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
  await persistAvailability(supabase, targetAthleteId, nextStatus)

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

  // Reassessments only apply to a still-open occurrence. Verify (read-only) first
  // and use the row's own athlete_id, not the client-supplied one.
  const { data: openOcc, error: occErr } = await supabase
    .from('occurrences')
    .select('athlete_id, is_resolved')
    .eq('id', input.occurrenceId)
    .single()
  if (occErr || !openOcc?.athlete_id || openOcc.is_resolved) {
    throw new Error(occErr?.message ?? 'Ocorrência já resolvida ou inexistente')
  }
  const targetAthleteId = openOcc.athlete_id

  // Insert the reassessment record BEFORE mutating the occurrence status, so a
  // rejected insert can't leave the status changed with no audit entry.
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

  // Now update the occurrence's own status (still guarded on is_resolved=false).
  // If it matched no row, the occurrence was resolved concurrently between our
  // SELECT and here — in that case this occurrence's status must NOT be the
  // recompute fallback (it would wrongly re-open the athlete).
  const { data: statusUpdated } = await supabase
    .from('occurrences')
    .update({ availability_status: input.availabilityStatus })
    .eq('id', input.occurrenceId)
    .eq('is_resolved', false)
    .select('id')
    .maybeSingle()

  // Recompute from all active occurrences/diagnoses so a less-restrictive
  // reassessment on one issue doesn't clear a still-active one elsewhere.
  const fallback = statusUpdated ? input.availabilityStatus : 'available'
  const nextStatus = await recomputeAthleteAvailability(supabase, targetAthleteId, fallback)
  await persistAvailability(supabase, targetAthleteId, nextStatus)

  revalidatePath('/occurrences')
  revalidatePath('/')
}
