'use server'

// Server actions for clinical writes whose author/audit fields must be derived
// from the authenticated session, never trusted from the browser payload
// (which a tampered request could forge to impersonate another clinician).
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Avail = 'available' | 'evaluation' | 'unavailable' | 'rtp' | 'load_management'
const SEVERITY: Record<Avail, number> = { available: 0, evaluation: 1, load_management: 2, rtp: 3, unavailable: 4 }

// The athlete's status is whatever the MOST RECENTLY recorded open
// occurrence/diagnosis says — not the most restrictive of all open issues.
// A newer clinical call supersedes an older one, even if less restrictive.
// Active rehab still acts as a floor (an ongoing RTP protocol isn't silently
// overridden by an unrelated occurrence that happens to have a newer
// timestamp).
async function recomputeAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  fallback: Avail,
): Promise<Avail> {
  const [occResult, diagResult, rehabResult] = await Promise.all([
    supabase.from('occurrences').select('availability_status, created_at, updated_at').eq('athlete_id', athleteId).eq('is_resolved', false),
    supabase.from('diagnoses').select('availability_status, diagnosed_at').eq('athlete_id', athleteId).eq('is_resolved', false),
    // SECURITY DEFINER RPC so the rehab floor is seen regardless of role.
    supabase.rpc('athlete_in_active_rehab', { p_athlete_id: athleteId }),
  ])
  // A failed read resolves as { data: null, error }, not a throw. Ignoring it
  // would drop a restrictive open issue/rehab floor and persist a wrongly
  // permissive status — abort instead of recomputing from partial data.
  const sourceError = occResult.error ?? diagResult.error ?? rehabResult.error
  if (sourceError) {
    throw new Error(`Não foi possível recalcular a disponibilidade: ${sourceError.message}`)
  }
  const occ = occResult.data
  const diag = diagResult.data
  const inActiveRehab = rehabResult.data

  type TimedStatus = { status: Avail; at: string }
  const events: TimedStatus[] = [
    ...(occ ?? [])
      .filter((r): r is { availability_status: Avail; created_at: string; updated_at: string | null } =>
        r.availability_status != null && r.availability_status in SEVERITY)
      .map((r) => ({ status: r.availability_status, at: r.updated_at ?? r.created_at })),
    ...(diag ?? [])
      .filter((r): r is { availability_status: Avail; diagnosed_at: string } =>
        r.availability_status != null && r.availability_status in SEVERITY)
      .map((r) => ({ status: r.availability_status, at: r.diagnosed_at })),
  ]

  // ISO 8601 timestamps compare correctly as strings.
  let result: Avail = events.length
    ? events.reduce((latest, e) => (e.at > latest.at ? e : latest)).status
    : fallback

  if (inActiveRehab === true && SEVERITY.rtp > SEVERITY[result]) result = 'rtp'

  return result
}

// Persist availability, throwing on a structured RPC error so a transient
// failure doesn't silently leave the athlete's status stale after a write.
async function persistAvailability(
  supabase: Awaited<ReturnType<typeof createClient>>,
  athleteId: string,
  status: Avail,
) {
  const { error } = await supabase.rpc('update_athlete_availability', { p_athlete_id: athleteId, p_status: status })
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

  const { error } = await supabase.from('diagnoses').insert({
    athlete_id:          input.athleteId,
    org_id:              prof?.org_id ?? null,
    osiics_code:         input.osiicsCode,
    osiics_description:  input.osiicsDescription,
    diagnosis_type:      input.diagnosisType,
    custom_description:  input.customDescription,
    availability_status: input.availabilityStatus,
    load_management_restrictions: input.loadManagementRestrictions,
    load_management_notes: input.loadManagementNotes,
    diagnosed_by:        user?.id ?? null, // authoritative author, not client-supplied
    occurrence_id:       input.occurrenceId,
  })
  if (error) throw new Error(error.message)

  // The occurrence's own availability_status is a separate stored value from
  // the diagnosis — without this, the occurrence keeps showing its pre-
  // diagnosis status even though the athlete's overall status (recomputed
  // below) is correct.
  if (input.occurrenceId) {
    // updated_at is set explicitly — nothing bumps it automatically — so
    // recomputeAvailability's "most recent event wins" ranking sees this
    // diagnosis as newer than the occurrence's original creation.
    const { error: occError } = await supabase
      .from('occurrences')
      .update({
        availability_status: input.availabilityStatus,
        load_management_restrictions: input.loadManagementRestrictions,
        load_management_notes: input.loadManagementNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.occurrenceId)
    if (occError) throw new Error(occError.message)
  }

  const next = await recomputeAvailability(supabase, input.athleteId, input.availabilityStatus)
  await persistAvailability(supabase, input.athleteId, next)

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

  const { data: updated, error } = await supabase
    .from('diagnoses')
    .update({
      osiics_code:         input.osiicsCode,
      osiics_description:  input.osiicsDescription,
      diagnosis_type:      input.diagnosisType,
      custom_description:  input.customDescription,
      availability_status: input.availabilityStatus,
      load_management_restrictions: input.loadManagementRestrictions,
      load_management_notes: input.loadManagementNotes,
      occurrence_id:       input.occurrenceId,
    })
    .eq('id', input.diagnosisId)
    .eq('is_resolved', false)
    .select('athlete_id')
    .maybeSingle()
  if (error || !updated?.athlete_id) throw new Error(error?.message ?? 'Diagnóstico já resolvido ou inexistente')

  const targetAthleteId = updated.athlete_id

  if (input.occurrenceId) {
    const { error: occError } = await supabase
      .from('occurrences')
      .update({
        availability_status: input.availabilityStatus,
        load_management_restrictions: input.loadManagementRestrictions,
        load_management_notes: input.loadManagementNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.occurrenceId)
    if (occError) throw new Error(occError.message)
  }

  const next = await recomputeAvailability(supabase, targetAthleteId, input.availabilityStatus)
  await persistAvailability(supabase, targetAthleteId, next)

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
  const next = await recomputeAvailability(supabase, targetAthleteId, 'available')
  await persistAvailability(supabase, targetAthleteId, next)

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

