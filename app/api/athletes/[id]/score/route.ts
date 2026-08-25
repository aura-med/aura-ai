// app/api/athletes/[id]/score/route.ts
// POST /api/athletes/[id]/score
// Recalculates and persists the injury risk score for a given athlete.
// Architecture doc §3: "scoring corre no servidor, nunca no cliente"

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { verifyApiViewerFromRequest, type ApiViewer } from '@/lib/api/auth'
import { errorFromUnknown } from '@/lib/api/errors'
import { requireClinical } from '@/lib/api/supabase-services'
import { calculateScore, BASE_WEIGHTS_V1 } from '@/lib/scoring/engine'
import { authorizeScoreAccess, normalizeOrgId } from '@/lib/scoring/score-access'
import { ScoreHistorySchema } from '@/lib/schemas/score'
import { generateAndPersistRecommendations } from '@/lib/actions/recommendations'
import { logAudit } from '@/lib/audit'
import { REHAB_ROLES } from '@/lib/roles'
import type { ScoreInputs, UserRole } from '@/types'

// score_history RLS restricts writes to owner/doctor/physio; REHAB_ROLES is
// exactly [doctor, physio] and owner is checked separately.
const SCORE_WRITER_ROLES = REHAB_ROLES

type SupabaseClient = Awaited<ReturnType<typeof createClient>> | NonNullable<ReturnType<typeof createServiceRoleClient>>

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const apiViewer = await getApiViewer(request).catch((error) => error)
  if (apiViewer instanceof Error) return errorFromUnknown(apiViewer)
  const apiClient = apiViewer ? createServiceRoleClient() : null
  if (apiViewer && !apiClient) {
    return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 500 })
  }
  if (apiViewer) requireClinical(apiViewer)
  const response = await recalculateAthleteScore(id, apiClient ?? undefined, apiViewer ?? undefined)

  if (response.status === 200 && apiViewer) {
    await logAudit({
      userId:       apiViewer.userId,
      userEmail:    apiViewer.email,
      orgId:        apiViewer.orgId,
      action:       'athlete.score.calculate',
      resourceType: 'athlete',
      resourceId:   id,
    })
  }

  return NextResponse.json(response.body, { status: response.status })
}

async function getApiViewer(request: NextRequest) {
  if (!request.headers.get('authorization')) return null
  return verifyApiViewerFromRequest(request)
}

export async function recalculateAthleteScore(id: string, supabase?: SupabaseClient, apiViewer?: ApiViewer) {
  const client = supabase ?? await createClient()

  const { data: { user } } = apiViewer
    ? { data: { user: { id: apiViewer.userId } } }
    : await client.auth.getUser()
  if (!user?.id) {
    return { body: { error: 'Unauthorized' }, status: 401 }
  }

  const today = new Date().toISOString().split('T')[0]

  const [{ data: profile }, { data: athlete }] = await Promise.all([
    apiViewer
      ? Promise.resolve({ data: { org_id: apiViewer.orgId, role: apiViewer.role } })
      : client
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .single(),
    client
      .from('athletes')
      .select('org_id, squad_id')
      .eq('id', id)
      .maybeSingle(),
  ])

  const access = authorizeScoreAccess({
    userId: user.id,
    profileOrgId: normalizeOrgId(profile?.org_id),
    athleteOrgId: normalizeOrgId(athlete?.org_id),
    athleteFound: !!athlete,
  })

  if (!access.ok) {
    return { body: { error: access.error }, status: access.status }
  }

  // Persistence below runs through the service-role client (bypasses RLS), so
  // both the score-write ROLE and the athlete's SQUAD must be enforced here,
  // mirroring the score_history RLS (owner/doctor/physio) + athletes squad scope.
  const viewerRole = (profile as { role?: string | null } | null)?.role ?? null
  if (viewerRole !== 'owner' && !SCORE_WRITER_ROLES.includes(viewerRole as UserRole)) {
    return { body: { error: 'Forbidden' }, status: 403 }
  }
  if (viewerRole !== 'owner') {
    const athleteSquadId = (athlete as { squad_id?: string | null } | null)?.squad_id ?? null
    const { data: squadRows } = await client
      .from('staff_squads')
      .select('squad_id')
      .eq('profile_id', user.id)
    const allowed = new Set((squadRows ?? []).map((r) => (r as { squad_id: string }).squad_id))
    if (!athleteSquadId || !allowed.has(athleteSquadId)) {
      return { body: { error: 'Forbidden' }, status: 403 }
    }
  }

  const persistenceClient = createServiceRoleClient() ?? client

  // Fetch latest wellness + GPS data after org authorization succeeds.
  const [{ data: checkin }, { data: gps28 }, { data: injuries }] = await Promise.all([
    client
      .from('wellness_checkins')
      .select('*')
      .eq('athlete_id', id)
      .eq('checkin_date', today)
      .eq('checkin_type', 'morning')
      .maybeSingle(),
    client
      .from('gps_sessions')
      .select('*')
      .eq('athlete_id', id)
      .gte('session_date', new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0])
      .order('session_date', { ascending: false }),
    client
      .from('injury_events')
      .select('location, is_recurrence')
      .eq('athlete_id', id),
  ])

  // Compute ACWR via EWMA (HSR-based)
  const acwr      = computeAcwr(gps28 ?? [], 'hsr_distance_m')
  const decelAcwr = computeAcwr(gps28 ?? [], 'decel_high_count')

  // Days since last match
  const lastMatch = gps28?.find((s) => s.session_type === 'match')
  const md = lastMatch
    ? Math.round((Date.now() - new Date(lastMatch.session_date).getTime()) / 86400000)
    : null

  // Injury history: count same-segment recurrences
  const recurrences = injuries?.filter((i) => i.is_recurrence).length ?? 0
  const historyVal  = recurrences === 0 ? 0 : recurrences === 1 ? 1 : 2

  const inputs: ScoreInputs = {
    history: historyVal,
    acwr:    acwr,
    hrv:     null,           // needs baseline delta — computed in normalization
    fatigue: checkin?.fatigue      ?? null,
    sleep:   checkin?.sleep_hours  ?? null,
    tqr:     checkin?.tqr          ?? null,
    stress:  checkin?.stress       ?? null,
    decel:   decelAcwr,
    md:      md,
  }

  const result = calculateScore(inputs, BASE_WEIGHTS_V1)

  // Validate score payload before persisting
  const scoreObj = {
    athlete_id:       id,
    score_date:       today,
    total_score:      result.score / 100,
    acwr_partial:     result.partials.acwr,
    hrv_partial:      result.partials.hrv,
    fatigue_partial:  result.partials.fatigue,
    sleep_partial:    result.partials.sleep,
    tqr_partial:      result.partials.tqr,
    history_partial:  result.partials.history,
    stress_partial:   result.partials.stress,
    decel_partial:    result.partials.decel,
    days_since_match: md,
    confidence:       result.confidence,
  }

  const validation = ScoreHistorySchema.safeParse(scoreObj)
  if (!validation.success) {
    return { body: { error: 'Invalid score payload' }, status: 422 }
  }

  // Persist to score_history (upsert — one score per athlete per day)
  // .select('id') returns the persisted row id for the recommendation log
  const { data: savedScore, error } = await persistenceClient
    .from('score_history')
    .upsert(
      { ...scoreObj, weights_version: 1 },
      { onConflict: 'athlete_id,score_date' }
    )
    .select('id')
    .single()

  if (error) {
    return { body: { error: error.message }, status: 500 }
  }

  // ── Generate and persist recommendations (EU AI Act Art. 12) ──────────────
  // Runs after score is saved — non-blocking on failure (fallback in action).
  const { recommendations, logId, error: recommendationError } = await generateAndPersistRecommendations({
    athleteId:        id,
    orgId:            access.orgId,
    scoreHistoryId:   savedScore?.id,
    riskLevel:        result.riskLevel,
    dominantVariable: result.dominantVariable ?? null,
    confidence:       result.confidence,
    modelVersion:     1,
  }, persistenceClient)

  return {
    body: {
      result,
      recommendations,
      recommendationLogId: logId,
      recommendationLogError: recommendationError ?? null,
    },
    status: 200,
  }
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
