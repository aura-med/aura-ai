// POST /api/athletes/[id]/score
// Recalculates and persists the injury risk score for a given athlete.
// Architecture doc §3: "scoring corre no servidor, nunca no cliente"

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateScore, BASE_WEIGHTS_V1 } from '@/lib/scoring/engine'
import type { ScoreInputs } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  // Fetch latest wellness + GPS data
  const [{ data: checkin }, { data: gps28 }, { data: injuries }] = await Promise.all([
    supabase
      .from('wellness_checkins')
      .select('*')
      .eq('athlete_id', id)
      .eq('checkin_date', today)
      .eq('checkin_type', 'morning')
      .maybeSingle(),
    supabase
      .from('gps_sessions')
      .select('*')
      .eq('athlete_id', id)
      .gte('session_date', new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0])
      .order('session_date', { ascending: false }),
    supabase
      .from('injury_events')
      .select('location, is_recurrence')
      .eq('athlete_id', id),
  ])

  // Compute ACWR via EWMA (HSR-based)
  const acwr = computeAcwr(gps28 ?? [], 'hsr_distance_m')
  const decelAcwr = computeAcwr(gps28 ?? [], 'decel_high_count')

  // Compute HRV delta from baseline (simple: last 7 days vs last 28 days)
  const hrv = checkin?.hrv_ms !== null && checkin?.hrv_ms !== undefined
    ? null  // Would need baseline to compute delta — null = missing
    : null

  // Days since last match
  const lastMatch = gps28?.find((s) => s.session_type === 'match')
  const md = lastMatch
    ? Math.round((Date.now() - new Date(lastMatch.session_date).getTime()) / 86400000)
    : null

  // Injury history: count same-segment recurrences
  const recurrences = injuries?.filter((i) => i.is_recurrence).length ?? 0
  const historyVal = recurrences === 0 ? 0 : recurrences === 1 ? 1 : 2

  const inputs: ScoreInputs = {
    history: historyVal,
    acwr:    acwr,
    hrv:     hrv,
    fatigue: checkin?.fatigue ?? null,
    sleep:   checkin?.sleep_hours ?? null,
    tqr:     checkin?.tqr ?? null,
    stress:  checkin?.stress ?? null,
    decel:   decelAcwr,
    md:      md,
  }

  const result = calculateScore(inputs, BASE_WEIGHTS_V1)

  // Persist to score_history (upsert — one score per athlete per day)
  const { error } = await supabase
    .from('score_history')
    .upsert({
      athlete_id:      id,
      score_date:      today,
      total_score:     result.score / 100,
      acwr_partial:    result.partials.acwr,
      hrv_partial:     result.partials.hrv,
      fatigue_partial: result.partials.fatigue,
      sleep_partial:   result.partials.sleep,
      tqr_partial:     result.partials.tqr,
      history_partial: result.partials.history,
      stress_partial:  result.partials.stress,
      decel_partial:   result.partials.decel,
      days_since_match: md,
      confidence:      result.confidence,
      weights_version: 1,
    }, { onConflict: 'athlete_id,score_date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ result })
}

// EWMA-based ACWR calculation (7-day acute / 28-day chronic)
function computeAcwr(
  sessions: Array<{ session_date: string; [key: string]: unknown }>,
  field: string
): number | null {
  if (sessions.length < 14) return null

  const lambdaAcute   = 2 / (7 + 1)   // 0.25
  const lambdaChronic = 2 / (28 + 1)  // ~0.069

  let ewmaAcute   = 0
  let ewmaChronic = 0

  for (const session of [...sessions].reverse()) {
    const val = (session[field] as number | null) ?? 0
    ewmaAcute   = val * lambdaAcute   + ewmaAcute   * (1 - lambdaAcute)
    ewmaChronic = val * lambdaChronic + ewmaChronic * (1 - lambdaChronic)
  }

  if (ewmaChronic === 0) return null
  return ewmaAcute / ewmaChronic
}
