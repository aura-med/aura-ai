'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type AvailabilityStatus = 'available' | 'evaluation' | 'unavailable' | 'rtp' | 'load_management'

// Recompute the athlete's availability from their still-open occurrences/
// diagnoses/active-rehab state and persist it — atomically: 078 locks the
// athletes row first, so a concurrent write to a DIFFERENT occurrence/
// diagnosis for the same athlete can't interleave with this one and have
// its own, actually-newer result overwritten by a stale one that merely
// happened to persist last (the previous shape read+decided in this file,
// then persisted via a separate call, with no lock spanning the gap).
// Falls back to `fallback` when nothing else is open.
async function recomputeAndPersistAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  fallback: AvailabilityStatus,
): Promise<void> {
  const { error } = await supabase.rpc('recompute_and_persist_athlete_availability', {
    p_athlete_id: athleteId,
    p_fallback: fallback,
  })
  if (error) throw new Error(`Não foi possível atualizar a disponibilidade: ${error.message}`)
}

export interface RegisterOccurrenceInput {
  athleteId: string
  orgId: string
  squadId: string | null
  microcycleNumber: number | null
  title: string
  occurrenceDate: string
  occurrenceType: 'complaint' | 'trauma' | 'disease' | 'other'
  subjective: string
  objective: string
  assessment: string
  plan: string
  availabilityStatus: AvailabilityStatus
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
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
    title: input.title,
    occurrence_date: input.occurrenceDate,
    occurrence_type: input.occurrenceType,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    availability_status: input.availabilityStatus,
    load_management_restrictions: input.loadManagementRestrictions,
    load_management_notes: input.loadManagementNotes,
    created_by: clinician.userId,
    clinician_name: clinician.name,
    clinician_role: clinician.role,
    is_resolved: false,
  })

  if (error) throw new Error(error.message)

  // Recompute from all active issues so a less-restrictive new occurrence
  // doesn't clear a still-active unavailable/rtp one.
  await recomputeAndPersistAvailability(supabase, input.athleteId, input.availabilityStatus)

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${input.athleteId}`)
}

export interface UpdateOccurrenceInput {
  occurrenceId: string
  title: string
  occurrenceDate: string
  occurrenceType: 'complaint' | 'trauma' | 'disease' | 'other'
  observations: string
  availabilityStatus: AvailabilityStatus
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
}

// Edits the occurrence's own record (title/date/type/observations/status) —
// distinct from addOccurrenceRecord, which appends a new reassessment entry.
// This corrects the original entry itself rather than logging a new event.
export async function updateOccurrence(input: UpdateOccurrenceInput) {
  const supabase = await createClient()

  // update_occurrence_own_edit (068) locks the row first, so decisionChanged
  // (whether to bump updated_at / mark decision_source: 'own') is derived
  // from a guaranteed-current snapshot rather than a SELECT taken before the
  // update — closing a race where a concurrent reassessment/diagnosis
  // mirror could land in between and get silently overwritten by this
  // edit's older values while still being credited as the decision source.
  // A pure metadata correction (title/date/observations, decision
  // untouched) must not re-rank this occurrence above a genuinely newer
  // decision elsewhere — recompute_and_persist_athlete_availability (078)
  // picks whichever open occurrence/diagnosis has the most recent
  // timestamp, so updated_at only moves forward when the clinical
  // decision itself actually changes here.
  const { data: updatedRows, error } = await supabase.rpc('update_occurrence_own_edit', {
    p_occurrence_id: input.occurrenceId,
    p_title: input.title,
    p_occurrence_date: input.occurrenceDate,
    p_occurrence_type: input.occurrenceType,
    p_assessment: input.observations,
    p_availability_status: input.availabilityStatus,
    p_load_management_restrictions: input.loadManagementRestrictions,
    p_load_management_notes: input.loadManagementNotes,
  })
  if (error) throw new Error(error.message)
  const updated = updatedRows?.[0]
  if (!updated?.athlete_id) throw new Error('Ocorrência não encontrada')

  const targetAthleteId = updated.athlete_id

  // A resolved occurrence's status is historical record-keeping, not a live
  // clinical decision — it must never touch the athlete's current
  // availability. Skipping this matters specifically when nothing else is
  // open: recompute_and_persist_athlete_availability would then have no
  // events at all and fall back to `input.availabilityStatus`, so
  // correcting a closed occurrence's old status field would otherwise
  // silently overwrite the athlete's actual current availability.
  if (!updated.is_resolved) {
    // Recompute from all active occurrences/diagnoses so editing this one's
    // status doesn't wrongly override a still-active issue elsewhere.
    await recomputeAndPersistAvailability(supabase, targetAthleteId, input.availabilityStatus)
  }

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${targetAthleteId}`)
}

export async function resolveOccurrence(
  occurrenceId: string,
  athleteId: string,
  resolutionStatus: AvailabilityStatus
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
  await recomputeAndPersistAvailability(supabase, targetAthleteId, resolutionStatus)

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${targetAthleteId}`)
}

export async function addOccurrenceRecord(input: {
  occurrenceId: string
  athleteId: string
  recordDate: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  availabilityStatus: AvailabilityStatus
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
}) {
  const supabase = await createClient()

  // add_occurrence_record_and_mirror (070) inserts the reassessment and,
  // only when it's still the most recent source for its occurrence, mirrors
  // it onto the occurrence's own status — all in one transaction, deriving
  // athlete_id from the (locked) occurrence row itself and rejecting a
  // resolved/missing occurrence, same as the app used to do with a separate
  // read. Doing the insert and mirror as two separate calls risked a race
  // with a concurrent createDiagnosis on the same occurrence: whichever
  // mirror update ran second could get rejected by
  // validate_occurrence_decision_source (065) because the other source was
  // now genuinely newer, even though this reassessment had already been
  // permanently saved — reporting failure and skipping availability
  // recomputation, and risking a duplicate reassessment on retry.
  // created_by/clinician_name are derived from auth.uid()/profiles inside
  // the RPC itself, not passed here — this function is directly callable
  // via the Data API and a parameter couldn't stop a caller from
  // attributing the reassessment to someone else.
  const { data: rows, error } = await supabase.rpc('add_occurrence_record_and_mirror', {
    p_occurrence_id: input.occurrenceId,
    p_record_date: input.recordDate,
    p_subjective: input.subjective,
    p_objective: input.objective,
    p_assessment: input.assessment,
    p_plan: input.plan,
    p_availability_status: input.availabilityStatus,
    p_load_management_restrictions: input.loadManagementRestrictions,
    p_load_management_notes: input.loadManagementNotes,
  })
  if (error) throw new Error(error.message)
  const record = rows?.[0]
  if (!record?.athlete_id) throw new Error('Ocorrência já resolvida ou inexistente')
  const targetAthleteId = record.athlete_id

  // Recompute from all active occurrences/diagnoses so a less-restrictive
  // reassessment on one issue doesn't clear a still-active one elsewhere.
  await recomputeAndPersistAvailability(supabase, targetAthleteId, input.availabilityStatus)

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${targetAthleteId}`)
}

// Corrects an existing reassessment's own content (typo, wrong status picked
// at the time) — unlike addOccurrenceRecord, this is not logging a new
// clinical event. It only resyncs the parent occurrence/athlete status when
// this record is the most recently *created* one for its occurrence (see
// below) — a correction to older history leaves the athlete's live status
// alone. To log a genuinely new reassessment, use addOccurrenceRecord instead.
export async function updateOccurrenceRecord(input: {
  recordId: string
  recordDate: string
  assessment: string
  availabilityStatus: AvailabilityStatus
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
}) {
  const supabase = await createClient()

  // update_occurrence_record_and_mirror (063) locks the record first, so
  // decisionChanged (whether to advance the parent occurrence's updated_at)
  // is derived from a guaranteed-current snapshot rather than a SELECT taken
  // before the update. It then updates the record and, only while it's
  // still the most recently *created* reassessment for its occurrence AND a
  // reassessment is still the occurrence's decision_source (a direct edit or
  // a diagnosis may have taken over since), mirrors the record's own
  // just-committed values onto the parent occurrence/athlete — all inside
  // one function, so there's no gap for a concurrent addOccurrenceRecord (a
  // genuinely newer reassessment) or another correction to this same record
  // to land in unnoticed.
  const { data: rows, error } = await supabase.rpc('update_occurrence_record_and_mirror', {
    p_record_id: input.recordId,
    p_record_date: input.recordDate,
    p_assessment: input.assessment,
    p_availability_status: input.availabilityStatus,
    p_load_management_restrictions: input.loadManagementRestrictions,
    p_load_management_notes: input.loadManagementNotes,
  })
  if (error) throw new Error(error.message)
  const result = rows?.[0]
  if (!result?.out_athlete_id) throw new Error('Reavaliação não encontrada')

  // out_mirrored is false (not an error) when this record is no longer the
  // latest reassessment, a reassessment is no longer the occurrence's
  // decision source, or the occurrence has since been resolved.
  if (result.out_mirrored) {
    await recomputeAndPersistAvailability(supabase, result.out_athlete_id, input.availabilityStatus)
  }

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${result.out_athlete_id}`)
}
