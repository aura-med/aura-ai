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

async function currentUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
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
export async function closeRehabPlan(planId: string, completed: boolean) {
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
    .select('athlete_id')
    .maybeSingle()
  if (error || !data?.athlete_id) throw new Error(error?.message ?? 'Plano já encerrado ou inexistente')

  revalidatePath(`/athletes/${data.athlete_id}`)
}

// ── Phases ───────────────────────────────────────────────────────────────────

export interface UpsertRehabPlanPhaseInput {
  phaseId?: string
  planId: string
  name: string
  criteria: string | null
  startDate: string
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
      .update({ name: input.name, criteria: input.criteria, start_date: input.startDate })
      .eq('id', input.phaseId)
      .eq('plan_id', input.planId)
    if (error) throw new Error(error.message)
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
      start_date:   input.startDate,
      created_by:   userId,
    })
    if (error) {
      // 23505 = unique_violation on (plan_id, phase_number) — a near-simultaneous
      // second "Nova Fase" submit raced this one's max+1 computation.
      if (error.code === '23505') throw new Error('Outra fase foi criada ao mesmo tempo — tenta novamente.')
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

// ── Days ─────────────────────────────────────────────────────────────────────

export interface UpsertRehabPlanDayInput {
  planId: string
  entryDate: string
  period: RehabPlanPeriod
  content: string | null
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
  const userId = await currentUserId(supabase)

  const { data: plan, error: planError } = await supabase
    .from('rehab_plans')
    .select('athlete_id')
    .eq('id', input.planId)
    .single()
  if (planError || !plan?.athlete_id) throw new Error(planError?.message ?? 'Plano não encontrado')

  const { data: source, error: sourceError } = await supabase
    .from('rehab_plan_days')
    .select('*')
    .eq('plan_id', input.planId)
    .eq('entry_date', input.fromDate)
    .eq('period', input.fromPeriod)
    .maybeSingle()
  if (sourceError) throw new Error(sourceError.message)
  if (!source) throw new Error('Não há nada para mover nesse dia/período.')

  if (input.fromDate === input.toDate && input.fromPeriod === input.toPeriod) {
    return // no-op: moving onto itself
  }

  const { data: destination, error: destError } = await supabase
    .from('rehab_plan_days')
    .select('id')
    .eq('plan_id', input.planId)
    .eq('entry_date', input.toDate)
    .eq('period', input.toPeriod)
    .maybeSingle()
  if (destError) throw new Error(destError.message)
  if (destination && !input.overwrite) {
    throw new Error(REHAB_DAY_OCCUPIED_ERROR)
  }

  // Write destination first, then clear the source — if the destination write
  // fails, the original entry is left untouched instead of being lost. This
  // is not a transaction, though: two separate Supabase calls can't be made
  // atomic without an RPC, so a failure specifically on the delete below
  // (after a successful write) leaves the content duplicated in both cells
  // rather than moved. Judged an acceptable, narrow residual risk over the
  // added complexity of a transactional RPC for this action.
  const { error: upsertError } = await supabase.from('rehab_plan_days').upsert({
    plan_id:     input.planId,
    entry_date:  input.toDate,
    period:      input.toPeriod,
    content:     source.content,
    is_rest_day: source.is_rest_day,
    phase_id:    source.phase_id,
    created_by:  source.created_by,
    updated_by:  userId,
  }, { onConflict: 'plan_id,entry_date,period' })
  if (upsertError) throw new Error(upsertError.message)

  const { error: deleteError } = await supabase.from('rehab_plan_days').delete().eq('id', source.id)
  if (deleteError) throw new Error(deleteError.message)

  revalidatePath(`/athletes/${plan.athlete_id}`)
}
