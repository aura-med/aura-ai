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

export async function registerOccurrence(input: RegisterOccurrenceInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
    created_by: user?.id,
    clinician_name: input.clinicianName,
    clinician_role: input.clinicianRole,
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

  await supabase
    .from('occurrences')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
      availability_status: resolutionStatus,
    })
    .eq('id', occurrenceId)

  // Recompute athlete availability from the remaining open occurrences/diagnoses
  // so resolving one occurrence doesn't clear a still-active injury elsewhere.
  // This occurrence is now resolved, so `resolutionStatus` only applies as the
  // fallback when nothing else is open.
  const nextStatus = await recomputeAthleteAvailability(supabase, athleteId, resolutionStatus)
  await supabase.rpc('update_athlete_availability', { p_athlete_id: athleteId, p_status: nextStatus })

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
  clinicianName: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Abort if the record insert fails (e.g. RLS rejection) — otherwise the
  // occurrence/athlete state would change with no reassessment in the audit trail.
  const { error: recordError } = await supabase.from('occurrence_records').insert({
    occurrence_id: input.occurrenceId,
    athlete_id: input.athleteId,
    record_date: input.recordDate,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    availability_status: input.availabilityStatus,
    created_by: user?.id,
    clinician_name: input.clinicianName,
  })
  if (recordError) throw new Error(recordError.message)

  // Update this occurrence's own status
  await supabase
    .from('occurrences')
    .update({ availability_status: input.availabilityStatus })
    .eq('id', input.occurrenceId)

  // Recompute from all active occurrences/diagnoses so a less-restrictive
  // reassessment on one issue doesn't clear a still-active one elsewhere.
  const nextStatus = await recomputeAthleteAvailability(supabase, input.athleteId, input.availabilityStatus)
  await supabase.rpc('update_athlete_availability', { p_athlete_id: input.athleteId, p_status: nextStatus })

  revalidatePath('/occurrences')
  revalidatePath('/')
}
