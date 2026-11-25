'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import type { InjuryCharacterizationFields } from '@/lib/actions/clinical'

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
    .select('full_name, role, org_id')
    .eq('id', user?.id ?? '')
    .single()
  return { userId: user?.id, email: user?.email ?? '', name: profile?.full_name ?? '', role: profile?.role ?? '', orgId: profile?.org_id ?? '' }
}

export async function registerOccurrence(input: RegisterOccurrenceInput) {
  // Opening an occurrence only ever decides between Apto and A Avaliar — every
  // other outcome (Gestão de Carga, Indisponível, RTP) is only ever reached
  // through a reassessment or the rehab plan. The UI already restricts the
  // select to these two; this is defense in depth against a crafted call.
  if (input.availabilityStatus !== 'available' && input.availabilityStatus !== 'evaluation') {
    throw new Error('Uma ocorrência só pode abrir como Disponível ou A Avaliar.')
  }
  const supabase = await createClient()
  const clinician = await getClinician(supabase)

  const { data: inserted, error } = await supabase.from('occurrences').insert({
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
  }).select('id').single()

  if (error) throw new Error(error.message)

  // Recompute from all active issues so a less-restrictive new occurrence
  // doesn't clear a still-active unavailable/rtp one.
  await recomputeAndPersistAvailability(supabase, input.athleteId, input.availabilityStatus)

  await logAudit({
    userId: clinician.userId ?? '', userEmail: clinician.email, orgId: input.orgId,
    action: 'occurrence.create', resourceType: 'occurrence', resourceId: inserted?.id,
    metadata: { athleteId: input.athleteId },
  })

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
  const clinician = await getClinician(supabase)

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

  await logAudit({
    userId: clinician.userId ?? '', userEmail: clinician.email, orgId: clinician.orgId,
    action: 'occurrence.update', resourceType: 'occurrence', resourceId: input.occurrenceId,
  })

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${targetAthleteId}`)
}

export async function resolveOccurrence(
  occurrenceId: string,
  athleteId: string,
  resolutionStatus: AvailabilityStatus,
  resolvedAt?: string | null
) {
  const supabase = await createClient()
  const clinician = await getClinician(supabase)

  // resolve_occurrence_with_date (094) does the is_resolved=false guard and
  // the resolved_at/resolved_by derivation itself (via set_occurrence_audit,
  // trusting a backdated resolvedAt only through this RPC's own
  // app.trusted_resolved_at GUC — see 094's header). Trust the occurrence
  // row's own athlete_id from the RPC's return, not the client-supplied
  // athleteId, so we never recompute availability for the wrong athlete.
  const { data: resolvedRows, error: resolveError } = await supabase.rpc('resolve_occurrence_with_date', {
    p_occurrence_id: occurrenceId,
    p_resolution_status: resolutionStatus,
    p_resolved_at: resolvedAt ?? null,
  })

  // No row returned (stale id, already resolved, or RLS-filtered) → nothing
  // was resolved; abort before touching availability so a crafted call can't
  // move an athlete's state.
  const resolved = resolvedRows?.[0]
  if (resolveError || !resolved?.athlete_id) {
    throw new Error(resolveError?.message ?? 'Ocorrência não encontrada')
  }
  const targetAthleteId = resolved.athlete_id

  // Recompute athlete availability from the remaining open occurrences/diagnoses
  // so resolving one occurrence doesn't clear a still-active injury elsewhere.
  // This occurrence is now resolved, so `resolutionStatus` only applies as the
  // fallback when nothing else is open.
  await recomputeAndPersistAvailability(supabase, targetAthleteId, resolutionStatus)

  await logAudit({
    userId: clinician.userId ?? '', userEmail: clinician.email, orgId: clinician.orgId,
    action: 'occurrence.resolve', resourceType: 'occurrence', resourceId: occurrenceId,
  })

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
  const clinician = await getClinician(supabase)

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

  await logAudit({
    userId: clinician.userId ?? '', userEmail: clinician.email, orgId: clinician.orgId,
    action: 'occurrence_record.create', resourceType: 'occurrence_record', resourceId: record.id,
    metadata: { occurrenceId: input.occurrenceId },
  })

  revalidatePath('/occurrences')
  revalidatePath('/')
  revalidatePath(`/athletes/${targetAthleteId}`)
}

// Concludes a reassessment as Indisponível together with its now-mandatory
// diagnosis, in one atomic call — mirrors addOccurrenceRecord above but goes
// through conclude_reassessment_with_diagnosis (098) instead of 070, which
// inserts the diagnosis first and errors if diagnosisType is missing (the
// trigger added in 098 enforces the same rule even for a direct Data API
// call, so this isn't the only thing preventing a diagnosis-less
// Indisponível — just the one that gives the UI a clean, atomic save).
export async function addOccurrenceRecordWithDiagnosis(input: {
  occurrenceId: string
  athleteId: string
  recordDate: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
  diagnosisType: 'injury' | 'disease'
  osiicsCode: string | null
  osiicsDescription: string | null
  customDescription: string | null
} & Partial<InjuryCharacterizationFields>) {
  const supabase = await createClient()
  const clinician = await getClinician(supabase)

  const { data: rows, error } = await supabase.rpc('conclude_reassessment_with_diagnosis', {
    p_occurrence_id: input.occurrenceId,
    p_record_date: input.recordDate,
    p_subjective: input.subjective,
    p_objective: input.objective,
    p_assessment: input.assessment,
    p_plan: input.plan,
    p_availability_status: 'unavailable',
    p_load_management_restrictions: input.loadManagementRestrictions,
    p_load_management_notes: input.loadManagementNotes,
    p_diagnosis_type: input.diagnosisType,
    p_osiics_code: input.osiicsCode,
    p_osiics_description: input.osiicsDescription,
    p_custom_description: input.customDescription,
    p_diagnosis_date: input.diagnosisDate ?? null,
    p_context: input.context ?? null,
    p_match_minute: input.matchMinute ?? null,
    p_mechanism: input.mechanism ?? null,
    p_contact_type: input.contactType ?? null,
    p_player_action: input.playerAction ?? null,
    p_foul_involved: input.foulInvolved ?? null,
    p_body_region: input.bodyRegion ?? null,
    p_body_side: input.bodySide ?? null,
    p_tissue_type: input.tissueType ?? null,
    p_is_recurrence: input.isRecurrence ?? null,
    p_related_diagnosis_id: input.relatedDiagnosisId ?? null,
    p_claim_filed: input.claimFiled ?? null,
  })
  if (error) throw new Error(error.message)
  const record = rows?.[0]
  if (!record?.athlete_id) throw new Error('Ocorrência já resolvida ou inexistente')
  const targetAthleteId = record.athlete_id

  await recomputeAndPersistAvailability(supabase, targetAthleteId, 'unavailable')

  await logAudit({
    userId: clinician.userId ?? '', userEmail: clinician.email, orgId: clinician.orgId,
    action: 'occurrence_record.create', resourceType: 'occurrence_record', resourceId: record.id,
    metadata: { occurrenceId: input.occurrenceId },
  })
  await logAudit({
    userId: clinician.userId ?? '', userEmail: clinician.email, orgId: clinician.orgId,
    action: 'diagnosis.create', resourceType: 'diagnosis',
    metadata: { occurrenceId: input.occurrenceId, diagnosisType: input.diagnosisType },
  })

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
