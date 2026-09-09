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

  // resolve_diagnosis_and_cleanup (080) does all of this atomically, in one
  // transaction: resolves the diagnosis; while it's still the open
  // occurrence's decision source, re-derives that occurrence's status from
  // its own latest reassessment (or resets decision_source to 'own' if
  // there isn't one) — otherwise the occurrence would keep this
  // now-resolved diagnosis's mirrored status indefinitely, and
  // recompute_and_persist_athlete_availability below would keep surfacing
  // it as the athlete's live restriction; and, for 'injury' diagnoses,
  // preserves the injury permanently in the athlete's history
  // (injury_events) — folded into the same transaction rather than a
  // separate follow-up insert, so a failure there rolls back the
  // resolution too instead of leaving the diagnosis permanently resolved
  // with no way to retry the now-lost history row. resolved_by/
  // confirmed_by are derived from auth.uid() inside the RPC, not passed
  // here.
  const { data: rows, error } = await supabase.rpc('resolve_diagnosis_and_cleanup', {
    p_diagnosis_id: diagnosisId,
  })
  if (error) throw new Error(error.message)
  const resolved = rows?.[0]
  if (!resolved?.athlete_id) throw new Error('Diagnóstico já resolvido ou inexistente')

  const targetAthleteId = resolved.athlete_id
  await recomputeAndPersistAvailability(supabase, targetAthleteId, 'available')

  revalidatePath(`/athletes/${targetAthleteId}`)
  revalidatePath('/occurrences')
  revalidatePath('/')
}

// ── Protocol suggestion ─────────────────────────────────────────────────────

export interface SuggestedProtocol {
  id: string
  key: string
  name: string
  total_days: number
  color: string
  return_days_min: number | null
  return_days_max: number | null
}

export async function getSuggestedProtocol(protocolKey: string): Promise<SuggestedProtocol | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rehab_protocols')
    .select('id, key, name, total_days, color, return_days_min, return_days_max')
    .eq('key', protocolKey)
    .eq('is_template', true)
    .maybeSingle()
  return data ?? null
}

export async function startRehabProtocol(athleteId: string, protocolId: string, occurrenceId: string | null) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch protocol data to build the rehab_plans entry
  const { data: proto } = await supabase
    .from('rehab_protocols')
    .select('name, total_days, phases')
    .eq('id', protocolId)
    .maybeSingle()

  // Fetch athlete's org/squad for the plan row
  const { data: athlete } = await supabase
    .from('athletes')
    .select('org_id, squad_id')
    .eq('id', athleteId)
    .maybeSingle()

  // Insert protocol-tracking session (used by /rehab-protocol)
  const { error: sessErr } = await supabase.from('rehab_sessions').insert({
    athlete_id:    athleteId,
    protocol_id:   protocolId,
    start_date:    today,
    session_date:  today,
    session_type:  'physio',
    current_day:   1,
    occurrence_id: occurrenceId ?? null,
  })
  if (sessErr) throw new Error(sessErr.message)

  // Also create a rehab_plans entry (used by /rehab planning view)
  if (proto) {
    const protoPhases = Array.isArray(proto.phases)
      ? proto.phases as Array<{ d1: number; name?: string; criteria?: string }>
      : []

    // RTP criteria from the last phase
    const lastPhase = protoPhases[protoPhases.length - 1]
    const rtpCriteria = lastPhase?.criteria
      ? lastPhase.criteria
          .split(/;|\./)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((label: string, i: number) => ({ id: `rtp_${i}`, label, done: false }))
      : []

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + (proto.total_days ?? 21))

    const { data: planRow, error: planErr } = await supabase.from('rehab_plans').insert({
      athlete_id:        athleteId,
      org_id:            athlete?.org_id ?? null,
      squad_id:          athlete?.squad_id ?? null,
      occurrence_id:     occurrenceId ?? null,
      title:             proto.name,
      start_date:        today,
      expected_end_date: endDate.toISOString().split('T')[0],
      rtp_criteria:      rtpCriteria,
    }).select('id').single()

    // The rehab_plan is what /rehab shows — a silent failure here is exactly the
    // "protocolo iniciado mas plano não aparece" bug, so surface it.
    if (planErr || !planRow?.id) {
      throw new Error(`Falha ao criar o plano de reabilitação: ${planErr?.message ?? 'a base de dados não devolveu o plano'}`)
    }

    // Copy protocol phases into rehab_plan_phases so the calendar shows them
    if (protoPhases.length > 0) {
      const phaseRows = protoPhases.map((ph, i) => {
        const phaseStart = new Date(today)
        phaseStart.setDate(phaseStart.getDate() + ((ph.d1 ?? 1) - 1))
        return {
          plan_id:      planRow.id,
          phase_number: i + 1,
          name:         ph.name ?? `Fase ${i + 1}`,
          criteria:     ph.criteria ?? null,
          start_date:   phaseStart.toISOString().split('T')[0],
          created_by:   user?.id ?? null,
        }
      })
      const { error: phaseErr } = await supabase.from('rehab_plan_phases').insert(phaseRows)
      if (phaseErr) throw new Error(`Plano criado, mas falhou a inserção das fases: ${phaseErr.message}`)
    }
  }

  revalidatePath(`/athletes/${athleteId}`)
  revalidatePath('/rehab-protocol')
  revalidatePath('/rehab')
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

