'use server'

// Server actions for clinical writes whose author/audit fields must be derived
// from the authenticated session, never trusted from the browser payload
// (which a tampered request could forge to impersonate another clinician).
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Avail = 'available' | 'evaluation' | 'unavailable' | 'rtp' | 'load_management'

// Recompute the athlete's availability from their still-open occurrences/
// diagnoses/active-rehab state and persist it — atomically:
// recompute_and_persist_athlete_availability (078) locks the athletes row
// first, so a concurrent write to a DIFFERENT occurrence/diagnosis for the
// same athlete can't interleave with this one and have its own,
// actually-newer result overwritten by a stale one that merely happened to
// persist last (the previous shape read+decided in TypeScript, then
// persisted via a separate call, with no lock spanning the gap). The
// athlete's status is whatever the MOST RECENTLY recorded open occurrence/
// diagnosis says — not the most restrictive of all open issues; active
// rehab still acts as a floor. Falls back to `fallback` when nothing else
// is open.
async function recomputeAndPersistAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  fallback: Avail,
): Promise<void> {
  const { error } = await supabase.rpc('recompute_and_persist_athlete_availability', {
    p_athlete_id: athleteId,
    p_fallback: fallback,
  })
  if (error) throw new Error(`Não foi possível atualizar a disponibilidade: ${error.message}`)
}

export interface CreateDiagnosisInput {
  athleteId: string
  osiicsCode: string | null
  osiicsDescription: string | null
  diagnosisType: 'injury' | 'disease'
  customDescription: string | null
  availabilityStatus: Avail
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
  occurrenceId: string | null
}

export async function createDiagnosis(input: CreateDiagnosisInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user?.id ?? '')
    .single()

  // An occurrence can only carry one active diagnosis — check before insert
  // so a second click (or a stale UI that still shows the button) can't
  // attach a duplicate.
  if (input.occurrenceId) {
    const { data: existing, error: existingError } = await supabase
      .from('diagnoses')
      .select('id')
      .eq('occurrence_id', input.occurrenceId)
      .eq('is_resolved', false)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) throw new Error('Esta ocorrência já tem um diagnóstico ativo.')
  }

  // create_diagnosis_and_mirror (069) inserts the diagnosis and, only when
  // it's still the most recent source for its occurrence, mirrors it onto
  // the occurrence's own status — all in one transaction. Doing this as two
  // separate calls (insert, then a separate mirror update) risked a race
  // with a concurrent addOccurrenceRecord on the same occurrence: whichever
  // mirror update ran second could get rejected by
  // validate_occurrence_decision_source (065) because the other source was
  // now genuinely newer, even though this diagnosis had already been
  // permanently saved — reporting failure and skipping availability
  // recomputation for real clinical data that did save.
  // diagnosed_by is derived from auth.uid() inside the RPC itself (069) —
  // not passed here — since this function is directly callable via the
  // Data API and a parameter couldn't stop a caller from attributing the
  // diagnosis to someone else.
  const { error } = await supabase.rpc('create_diagnosis_and_mirror', {
    p_athlete_id: input.athleteId,
    p_org_id: prof?.org_id ?? null,
    p_osiics_code: input.osiicsCode,
    p_osiics_description: input.osiicsDescription,
    p_diagnosis_type: input.diagnosisType,
    p_custom_description: input.customDescription,
    p_availability_status: input.availabilityStatus,
    p_load_management_restrictions: input.loadManagementRestrictions,
    p_load_management_notes: input.loadManagementNotes,
    p_occurrence_id: input.occurrenceId,
  })
  if (error) throw new Error(error.message)

  await recomputeAndPersistAvailability(supabase, input.athleteId, input.availabilityStatus)

  revalidatePath(`/athletes/${input.athleteId}`)
  revalidatePath('/occurrences')
  revalidatePath('/')
}

export interface UpdateDiagnosisInput {
  diagnosisId: string
  osiicsCode: string | null
  osiicsDescription: string | null
  diagnosisType: 'injury' | 'disease'
  customDescription: string | null
  availabilityStatus: Avail
  loadManagementRestrictions: string[]
  loadManagementNotes: string | null
  occurrenceId: string | null
}

// Corrects an existing diagnosis's own fields — distinct from resolveDiagnosis,
// which closes it out. Only reachable while unresolved: once resolved, the
// diagnosis has already migrated into the athlete's injury history and the UI
// never renders an edit affordance for it, but the guard is repeated here too.
export async function updateDiagnosis(input: UpdateDiagnosisInput) {
  const supabase = await createClient()

  // Same one-active-diagnosis-per-occurrence guard as createDiagnosis, excluding
  // this diagnosis itself so re-saving without changing the link doesn't self-conflict.
  if (input.occurrenceId) {
    const { data: existing, error: existingError } = await supabase
      .from('diagnoses')
      .select('id')
      .eq('occurrence_id', input.occurrenceId)
      .eq('is_resolved', false)
      .neq('id', input.diagnosisId)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    if (existing) throw new Error('Esta ocorrência já tem um diagnóstico ativo.')
  }

  // update_diagnosis_and_mirror (067) locks the diagnosis row first, so
  // decisionChanged is derived from a guaranteed-current snapshot rather
  // than a SELECT taken before the update — closing a race where a
  // concurrent edit to the same diagnosis could leave the app's cached
  // decisionChanged stale (see migration 067 for the exact scenario). It
  // also derives diagnoses.updated_at itself via the 047/051/066 trigger
  // (never set directly here), and skips the occurrence mirror entirely for
  // a pure description/metadata correction, for the same desync reasons
  // this comment used to explain inline.
  const { data: updatedRows, error } = await supabase.rpc('update_diagnosis_and_mirror', {
    p_diagnosis_id: input.diagnosisId,
    p_osiics_code: input.osiicsCode,
    p_osiics_description: input.osiicsDescription,
    p_diagnosis_type: input.diagnosisType,
    p_custom_description: input.customDescription,
    p_availability_status: input.availabilityStatus,
    p_load_management_restrictions: input.loadManagementRestrictions,
    p_load_management_notes: input.loadManagementNotes,
    p_occurrence_id: input.occurrenceId,
  })
  if (error) throw new Error(error.message)
  const updated = updatedRows?.[0]
  if (!updated?.athlete_id) throw new Error('Diagnóstico já resolvido ou inexistente')

  const targetAthleteId = updated.athlete_id

  await recomputeAndPersistAvailability(supabase, targetAthleteId, input.availabilityStatus)

  revalidatePath(`/athletes/${targetAthleteId}`)
  revalidatePath('/occurrences')
  revalidatePath('/')
}

export async function resolveDiagnosis(diagnosisId: string, athleteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // resolved_by derived from the session, not the client payload. Guard on
  // is_resolved=false so a stale/double resolve doesn't overwrite the original
  // resolved_at/resolved_by on an already-resolved diagnosis.
  const { data: resolved, error } = await supabase
    .from('diagnoses')
    .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
    .eq('id', diagnosisId)
    .eq('is_resolved', false)
    .select(`
      athlete_id, diagnosis_type, osiics_code, osiics_description, custom_description,
      diagnosed_at, resolved_at, occurrence_id,
      occurrences ( occurrence_date )
    `)
    .maybeSingle()
  if (error || !resolved?.athlete_id) throw new Error(error?.message ?? 'Diagnóstico já resolvido ou inexistente')

  // Recompute for the diagnosis row's own athlete, not the client-supplied id.
  // 'available' fallback: with this diagnosis now resolved, nothing else open
  // means the athlete is available (rehab floor still applies inside the helper).
  const targetAthleteId = resolved.athlete_id
  await recomputeAndPersistAvailability(supabase, targetAthleteId, 'available')

  // A resolved diagnosis is never just discarded — it's preserved permanently
  // in the athlete's injury history (histórico de lesões) so the clinical
  // record is never lost. 'disease' diagnoses are excluded: injury_events'
  // location/severity fields describe musculoskeletal injuries, not illness.
  if (resolved.diagnosis_type === 'injury') {
    const occurrence = Array.isArray(resolved.occurrences) ? resolved.occurrences[0] : resolved.occurrences
    const injuryDate = occurrence?.occurrence_date ?? (resolved.diagnosed_at ?? new Date().toISOString()).slice(0, 10)
    const returnDate = (resolved.resolved_at ?? new Date().toISOString()).slice(0, 10)
    const daysAbsent = Math.max(0, Math.round(
      (new Date(returnDate).getTime() - new Date(injuryDate).getTime()) / 86_400_000,
    ))
    // diagnoses carries no severity field — approximate it from days absent,
    // the same signal clinicians use to classify injury severity in practice.
    const severity: 'minor' | 'moderate' | 'major' | 'severe' =
      daysAbsent > 84 ? 'severe' : daysAbsent > 28 ? 'major' : daysAbsent > 7 ? 'moderate' : 'minor'

    const { data: clinician } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user?.id ?? '')
      .maybeSingle()

    const { error: injuryError } = await supabase.from('injury_events').insert({
      athlete_id:    targetAthleteId,
      injury_date:   injuryDate,
      return_date:   returnDate,
      diagnosis:     resolved.osiics_description ?? resolved.custom_description ?? 'Diagnóstico sem descrição',
      osiics_code:   resolved.osiics_code,
      severity,
      days_absent:   daysAbsent,
      is_recurrence: false,
      confirmed_by:  clinician?.full_name ?? null,
    })
    if (injuryError) throw new Error(`Diagnóstico resolvido, mas falhou a migração para o histórico de lesões: ${injuryError.message}`)
  }

  revalidatePath(`/athletes/${targetAthleteId}`)
  revalidatePath('/')
}

export interface AdministerMedicationInput {
  athleteId: string
  medicationName: string
  dose: string | null
  route: string
  notes: string | null
  administeredAt: string // ISO
}

export async function administerMedication(input: AdministerMedicationInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: prof } = await supabase
    .from('profiles')
    .select('org_id, full_name')
    .eq('id', user?.id ?? '')
    .single()

  const { data, error } = await supabase.from('medication_administrations').insert({
    athlete_id:           input.athleteId,
    org_id:               prof?.org_id ?? null,
    medication_name:      input.medicationName,
    dose:                 input.dose,
    route:                input.route,
    notes:                input.notes,
    administered_by:      user?.id ?? null,          // authoritative administrator
    administered_by_name: prof?.full_name ?? null,   // derived, not client-supplied
    administered_at:      input.administeredAt,
  }).select().single()
  if (error) throw new Error(error.message)

  // Both the athlete clinical file and the team-wide /medication view read the
  // same medication_administrations rows, so revalidate both to keep them synced.
  revalidatePath(`/athletes/${input.athleteId}`)
  revalidatePath('/medication')
  return data
}

export interface UpdateMedicationAdministrationInput {
  id: string
  medicationName: string
  dose: string | null
  route: string
  notes: string | null
  administeredAt: string // ISO
}

// Edit an existing administration. The administrator identity and the subject
// (athlete/org) are frozen by the 020/025 trigger, so only the clinical fields
// change; RLS (025) restricts this to owner + doctor/physio/masseur in scope.
export async function updateMedicationAdministration(input: UpdateMedicationAdministrationInput) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('medication_administrations')
    .update({
      medication_name: input.medicationName,
      dose:            input.dose,
      route:           input.route,
      notes:           input.notes,
      administered_at: input.administeredAt,
    })
    .eq('id', input.id)
    .select('athlete_id')
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/medication')
  if (data?.athlete_id) revalidatePath(`/athletes/${data.athlete_id}`)
  return data
}

// Delete an administration. RLS (025) restricts this to the same writer roles.
export async function deleteMedicationAdministration(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('medication_administrations')
    .delete()
    .eq('id', id)
    .select('athlete_id')
    .maybeSingle()
  if (error) throw new Error(error.message)

  revalidatePath('/medication')
  if (data?.athlete_id) revalidatePath(`/athletes/${data.athlete_id}`)
}

