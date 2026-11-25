'use server'

// Server actions for the Reabilitação tab's day-by-day plan calendar
// (migration 034: rehab_plans / rehab_plan_phases / rehab_plan_days).
// Audit fields (created_by/updated_by) are derived from the authenticated
// session, never trusted from the client payload — same pattern as
// lib/actions/clinical.ts and app/(dashboard)/occurrences/actions.ts.
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { RehabPlanPeriod } from '@/types/athlete-profile'
import { REHAB_DAY_OCCUPIED_ERROR } from '@/lib/actions/rehab-plan-errors'
import { resolveDiagnosis } from '@/lib/actions/clinical'

async function currentUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// The FK on rehab_plans.occurrence_id only checks the occurrence exists,
// not that it belongs to this plan's own athlete — without this, a crafted
// request could link a plan for athlete A to athlete B's occurrence. Same
// pattern as validateOccurrenceOwnership in
// app/api/athletes/[id]/rehab-sessions/route.ts.
async function validateOccurrenceOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  occurrenceId: string | null,
  athleteId: string,
): Promise<void> {
  if (!occurrenceId) return
  const { data, error } = await supabase
    .from('occurrences')
    .select('athlete_id')
    .eq('id', occurrenceId)
    .maybeSingle()
  if (error || !data || data.athlete_id !== athleteId) throw new Error('Ocorrência inválida para este atleta')
}

// ── Plans ────────────────────────────────────────────────────────────────────

export interface CreateRehabPlanInput {
  athleteId: string
  title: string
  startDate: string
  expectedEndDate: string | null
  occurrenceId: string | null
}

export async function createRehabPlan(input: CreateRehabPlanInput) {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', userId ?? '')
    .single()
  const { data: athlete } = await supabase
    .from('athletes')
    .select('squad_id')
    .eq('id', input.athleteId)
    .single()

  // An athlete can have several plans over a season (one per injury), but only
  // one active at a time — checked here for a clear error message; the
  // rehab_plans_one_active_per_athlete partial unique index is the DB-level
  // safety net if this check is ever raced or bypassed.
  const { data: existingActive, error: existingError } = await supabase
    .from('rehab_plans')
    .select('id')
    .eq('athlete_id', input.athleteId)
    .eq('is_active', true)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existingActive) throw new Error('Este atleta já tem um plano de reabilitação ativo. Termina-o antes de criar um novo.')

  await validateOccurrenceOwnership(supabase, input.occurrenceId, input.athleteId)

  const { data, error } = await supabase.from('rehab_plans').insert({
    athlete_id:        input.athleteId,
    org_id:            profile?.org_id ?? null,
    squad_id:          athlete?.squad_id ?? null,
    occurrence_id:     input.occurrenceId,
    title:             input.title,
    start_date:        input.startDate,
    expected_end_date: input.expectedEndDate,
    created_by:        userId,
  }).select().single()
  if (error) {
    // 23505 = unique_violation on rehab_plans_one_active_per_athlete — the
    // pre-check above lost a race with a concurrent create. Translate rather
    // than leak the raw constraint-name error to the clinician.
    if (error.code === '23505') throw new Error('Este atleta já tem um plano de reabilitação ativo. Termina-o antes de criar um novo.')
    throw new Error(error.message)
  }

  revalidatePath(`/athletes/${input.athleteId}`)
  return data
}

export interface UpdateRehabPlanInput {
  planId: string
  title: string
  startDate: string
  expectedEndDate: string | null
  occurrenceId: string | null
}

export async function updateRehabPlan(input: UpdateRehabPlanInput) {
  const supabase = await createClient()

  // Need the plan's own athlete_id to validate the new occurrenceId
  // against — RLS already scopes this read to plans the caller can see.
  const { data: existing, error: existingError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', input.planId)
    .maybeSingle()
  if (existingError || !existing?.athlete_id) throw new Error(existingError?.message ?? 'Plano não encontrado')

  await validateOccurrenceOwnership(supabase, input.occurrenceId, existing.athlete_id)

  const { data, error } = await supabase
    .from('rehab_plans')
    .update({
      title:             input.title,
      start_date:        input.startDate,
      expected_end_date: input.expectedEndDate,
      occurrence_id:     input.occurrenceId,
    })
    .eq('id', input.planId)
    .select('athlete_id')
    .maybeSingle()
  if (error || !data?.athlete_id) throw new Error(error?.message ?? 'Plano não encontrado')

  revalidatePath(`/athletes/${data.athlete_id}`)
}

// Closes a plan — either as successfully completed, or archived without
// completion (e.g. the athlete transferred, or the plan was abandoned).
// closed_at is stamped either way so the history view always shows when a
// plan stopped being active, not just for the "completed" outcome.
// Guarded on is_active=true so a stale UI can't re-close an already-closed plan.
export async function closeRehabPlan(
  planId: string,
  completed: boolean,
  resolveTargetDiagnosisId?: string | null,
  secondaryPreventionNote?: string | null,
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rehab_plans')
    .update({
      is_active:    false,
      is_completed: completed,
      closed_at:    new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('is_active', true)
    .select('athlete_id, occurrence_id')
    .maybeSingle()
  if (error || !data?.athlete_id) throw new Error(error?.message ?? 'Plano já encerrado ou inexistente')

  // When completed, resolve the linked injury diagnosis so it migrates into
  // injury history (injury_events) and availability is recomputed.
  // Priority: explicit diagnosisId > occurrence_id lookup > skip.
  if (completed) {
    const targetId = resolveTargetDiagnosisId ?? await (async () => {
      if (!data.occurrence_id) return null
      const { data: diag } = await supabase
        .from('diagnoses')
        .select('id')
        .eq('occurrence_id', data.occurrence_id)
        .eq('is_resolved', false)
        .eq('diagnosis_type', 'injury')
        .maybeSingle()
      return diag?.id ?? null
    })()
    if (targetId) {
      await resolveDiagnosis(targetId, data.athlete_id, null, secondaryPreventionNote)
    }
  }

  revalidatePath('/rehab')
  revalidatePath(`/athletes/${data.athlete_id}`)
}

// Returns active (unresolved) injury diagnoses for a given athlete — used by
// the "Concluir" picker when the plan has no occurrence_id.
export async function getActiveInjuryDiagnoses(athleteId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('diagnoses')
    .select('id, osiics_description, custom_description')
    .eq('athlete_id', athleteId)
    .eq('is_resolved', false)
    .eq('diagnosis_type', 'injury')
    .order('diagnosed_at', { ascending: false })
  return (data ?? []).map((d) => ({
    id:    d.id,
    label: d.osiics_description ?? d.custom_description ?? 'Diagnóstico sem descrição',
  }))
}

// ── Phases ───────────────────────────────────────────────────────────────────

export interface UpsertRehabPlanPhaseInput {
  phaseId?: string
  planId: string
  name: string
  criteria: string | null
  phaseType: 'standard' | 'rtp'
  startDate: string
  testDate: string | null
}

export async function upsertRehabPlanPhase(input: UpsertRehabPlanPhaseInput) {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', input.planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  if (input.phaseId) {
    const { error } = await supabase
      .from('rehab_plan_phases')
      .update({ name: input.name, criteria: input.criteria, phase_type: input.phaseType, start_date: input.startDate, test_date: input.testDate })
      .eq('id', input.phaseId)
      .eq('plan_id', input.planId)
    // 23505 = unique_violation on rehab_plan_phases_one_rtp_per_plan (096) —
    // a second phase was marked RTP while one already exists for this plan.
    if (error) {
      if (error.code === '23505') throw new Error('Este plano já tem uma fase de RTP.')
      throw new Error(error.message)
    }
  } else {
    // phase_number is derived server-side (max + 1) rather than client-supplied,
    // so two clinicians adding a phase near-simultaneously can't collide on the
    // plan_id/phase_number unique constraint from a stale client-side count.
    const { data: existing, error: countError } = await supabase
      .from('rehab_plan_phases')
      .select('phase_number')
      .eq('plan_id', input.planId)
      .order('phase_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (countError) throw new Error(countError.message)
    const nextNumber = (existing?.phase_number ?? 0) + 1

    const { error } = await supabase.from('rehab_plan_phases').insert({
      plan_id:      input.planId,
      phase_number: nextNumber,
      name:         input.name,
      criteria:     input.criteria,
      phase_type:   input.phaseType,
      start_date:   input.startDate,
      test_date:    input.testDate,
      created_by:   userId,
    })
    if (error) {
      // 23505 = unique_violation on either (plan_id, phase_number) — a
      // near-simultaneous second "Nova Fase" submit raced this one's max+1
      // computation — or rehab_plan_phases_one_rtp_per_plan (096), if this
      // was meant to be the plan's RTP phase and another already is.
      if (error.code === '23505') {
        throw new Error(
          input.phaseType === 'rtp'
            ? 'Este plano já tem uma fase de RTP.'
            : 'Outra fase foi criada ao mesmo tempo — tenta novamente.'
        )
      }
      throw new Error(error.message)
    }
  }

  revalidatePath(`/athletes/${plan.athlete_id}`)
}

export async function deleteRehabPlanPhase(phaseId: string, planId: string) {
  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  // rehab_plan_days.phase_id is ON DELETE SET NULL — any day tagged with this
  // phase just loses the tag, its content is untouched.
  const { error } = await supabase.from('rehab_plan_phases').delete().eq('id', phaseId).eq('plan_id', planId)
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${plan.athlete_id}`)
}

// ── Phase criteria (096) ─────────────────────────────────────────────────────

export interface UpsertRehabPhaseCriterionInput {
  criterionId?: string
  phaseId: string
  description: string
  metricLabel: string | null
  thresholdOperator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | null
  thresholdValue: number | null
  unit: string | null
  displayOrder: number
}

// Resolves the criterion's own plan's athlete_id for revalidation — joined
// through rehab_plan_phases since rehab_phase_criteria has no athlete_id of
// its own (RLS already scopes both reads to plans the caller can see).
async function athleteIdForPhase(supabase: Awaited<ReturnType<typeof createClient>>, phaseId: string): Promise<string> {
  const { data: phase, error: phaseError } = await supabase
    .from('rehab_plan_phases')
    .select('plan_id')
    .eq('id', phaseId)
    .single()
  if (phaseError || !phase?.plan_id) throw new Error(phaseError?.message ?? 'Fase não encontrada')

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', phase.plan_id)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')
  return plan.athlete_id
}

export async function upsertRehabPhaseCriterion(input: UpsertRehabPhaseCriterionInput) {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  const athleteId = await athleteIdForPhase(supabase, input.phaseId)

  if (input.criterionId) {
    const { error } = await supabase
      .from('rehab_phase_criteria')
      .update({
        description: input.description,
        metric_label: input.metricLabel,
        threshold_operator: input.thresholdOperator,
        threshold_value: input.thresholdValue,
        unit: input.unit,
        display_order: input.displayOrder,
      })
      .eq('id', input.criterionId)
      .eq('phase_id', input.phaseId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('rehab_phase_criteria').insert({
      phase_id: input.phaseId,
      description: input.description,
      metric_label: input.metricLabel,
      threshold_operator: input.thresholdOperator,
      threshold_value: input.thresholdValue,
      unit: input.unit,
      display_order: input.displayOrder,
      created_by: userId,
    })
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/athletes/${athleteId}`)
}

export async function deleteRehabPhaseCriterion(criterionId: string, phaseId: string) {
  const supabase = await createClient()
  const athleteId = await athleteIdForPhase(supabase, phaseId)

  const { error } = await supabase.from('rehab_phase_criteria').delete().eq('id', criterionId).eq('phase_id', phaseId)
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${athleteId}`)
}

// set_rehab_criterion_completion (096) derives completed_by/completed_at
// from the session server-side — never client-supplied, so a sign-off can't
// be forged (same pattern as diagnosed_by/diagnosed_at elsewhere).
export async function setRehabCriterionCompletion(criterionId: string, phaseId: string, isCompleted: boolean, measuredValue?: number | null) {
  const supabase = await createClient()
  const athleteId = await athleteIdForPhase(supabase, phaseId)

  const { data, error } = await supabase.rpc('set_rehab_criterion_completion', {
    p_criterion_id: criterionId,
    p_is_completed: isCompleted,
    p_measured_value: measuredValue ?? null,
  })
  if (error) throw new Error(error.message)
  if (!data?.[0]) throw new Error('Critério não encontrado')

  revalidatePath(`/athletes/${athleteId}`)
  return data[0]
}

// advance_rehab_plan_phase (096) raises if the plan's current phase still
// has incomplete criteria — a genuine gate, not just a UI affordance.
export async function advanceRehabPlanPhase(planId: string, nextPhaseId: string) {
  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  const { error } = await supabase.rpc('advance_rehab_plan_phase', {
    p_plan_id: planId,
    p_next_phase_id: nextPhaseId,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${plan.athlete_id}`)
}

// ── Days ─────────────────────────────────────────────────────────────────────

export interface UpsertRehabPlanDayInput {
  planId: string
  entryDate: string
  period: RehabPlanPeriod
  content: string | null
  notes: string | null
  isRestDay: boolean
  phaseId: string | null
}

export async function upsertRehabPlanDay(input: UpsertRehabPlanDayInput) {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', input.planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  // Preserve the original author's created_by across an edit — a single
  // upsert SETs every provided column on conflict, so without this an edit
  // to an existing day would silently reassign authorship to the editor.
  const { data: existingDay } = await supabase
    .from('rehab_plan_days')
    .select('created_by')
    .eq('plan_id', input.planId)
    .eq('entry_date', input.entryDate)
    .eq('period', input.period)
    .maybeSingle()

  const { error } = await supabase.from('rehab_plan_days').upsert({
    plan_id:     input.planId,
    entry_date:  input.entryDate,
    period:      input.period,
    content:     input.content,
    notes:       input.notes,
    is_rest_day: input.isRestDay,
    phase_id:    input.phaseId,
    created_by:  existingDay?.created_by ?? userId,
    updated_by:  userId,
  }, { onConflict: 'plan_id,entry_date,period' })
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${plan.athlete_id}`)
}

export async function deleteRehabPlanDay(dayId: string, planId: string) {
  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  const { error } = await supabase.from('rehab_plan_days').delete().eq('id', dayId).eq('plan_id', planId)
  if (error) throw new Error(error.message)

  revalidatePath(`/athletes/${plan.athlete_id}`)
}

export interface MoveRehabPlanDayInput {
  planId: string
  fromDate: string
  fromPeriod: RehabPlanPeriod
  toDate: string
  toPeriod: RehabPlanPeriod
  overwrite: boolean
}

// Relocates a day's planned content to a different date/period — the explicit
// "mover sessão" action (postponing/bringing forward a planned treatment),
// distinct from just editing a cell's text in place. Refuses to silently
// clobber an occupied destination unless the caller confirms via `overwrite`.
export async function moveRehabPlanDay(input: MoveRehabPlanDayInput) {
  const supabase = await createClient()

  // move_rehab_plan_day (083) locks the source AND destination rows before
  // writing, closing two races the previous multi-call version couldn't:
  // a partial failure between the destination write and the source delete
  // duplicating content across both cells, and two concurrent no-overwrite
  // moves onto the same empty destination both passing a read-only
  // occupancy check. It also carries the source's own created_by onto the
  // destination through a trusted, transaction-local flag the trigger
  // checks — a plain client write can't set that flag, so authorship can
  // no longer be forged by claiming "this is a move" on an unrelated write.
  const { data: athleteId, error } = await supabase.rpc('move_rehab_plan_day', {
    p_plan_id: input.planId,
    p_from_date: input.fromDate,
    p_from_period: input.fromPeriod,
    p_to_date: input.toDate,
    p_to_period: input.toPeriod,
    p_overwrite: input.overwrite,
  })
  if (error) {
    if (error.code === '23505') throw new Error(REHAB_DAY_OCCUPIED_ERROR)
    throw new Error(error.message)
  }
  if (!athleteId) return // no-op: moving onto itself

  revalidatePath(`/athletes/${athleteId}`)
}

// ── RTP criteria ──────────────────────────────────────────────────────────────

export interface RtpCriterionInput {
  id: string
  label: string
  done: boolean
}

export async function updateRtpCriteria(planId: string, criteria: RtpCriterionInput[]) {
  const supabase = await createClient()

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  const { error } = await supabase
    .from('rehab_plans')
    .update({ rtp_criteria: criteria })
    .eq('id', planId)
  if (error) throw new Error(error.message)

  revalidatePath('/rehab')
  revalidatePath(`/athletes/${plan.athlete_id}`)
}
