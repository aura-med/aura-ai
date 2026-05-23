'use server'

// ─────────────────────────────────────────────────────────────────────────────
// lib/actions/recommendations.ts
// Aura — Recommendations Server Actions
//
// Flow:
//   1. After calculateScore() → call generateAndPersistRecommendations()
//   2. Fetches org overrides from Supabase
//   3. Applies overrides to base rules
//   4. Persists to recommendation_log (EU AI Act Art. 12)
//   5. Returns RecommendationSet for immediate UI use
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server'
import {
  getOrgRecommendationSet,
  getRecommendationSet,
  type OrgOverride,
} from '@/lib/recommendations'
import type { RecommendationSet, RiskLevel, Confidence } from '@/types'

interface GenerateRecsParams {
  athleteId:       string
  orgId:           string
  scoreHistoryId?: string
  riskLevel:       RiskLevel
  dominantVariable: string | null
  confidence:      Confidence
  modelVersion?:   number
}

interface GenerateRecsResult {
  recommendations: RecommendationSet
  logId:           string | null
  error?:          string
}

/**
 * Main entry point — called by the scoring engine after every score calculation.
 * Fetches org overrides, generates the full RecommendationSet, and persists to log.
 */
export async function generateAndPersistRecommendations(
  params: GenerateRecsParams,
): Promise<GenerateRecsResult> {
  const {
    athleteId,
    orgId,
    scoreHistoryId,
    riskLevel,
    dominantVariable,
    confidence,
    modelVersion = 1,
  } = params

  const supabase = await createClient()

  try {
    // ── 1. Fetch org overrides (and config snapshot for audit) ────────────────
    const [overridesResult, configResult] = await Promise.all([
      supabase
        .from('org_recommendation_overrides')
        .select('variable, risk_level, stakeholder, override_type, custom_text, custom_icon, custom_timing, is_active')
        .eq('org_id', orgId)
        .eq('is_active', true),
      supabase
        .from('org_recommendation_config')
        .select('risk_thresholds, variable_weights, context_type, language')
        .eq('org_id', orgId)
        .maybeSingle(),
    ])

    const overrides = (overridesResult.data ?? []) as OrgOverride[]
    const orgConfigSnapshot = configResult.data ?? null

    // ── 2. Generate recommendations ──────────────────────────────────────────
    const recommendations = overrides.length > 0
      ? getOrgRecommendationSet(dominantVariable, riskLevel, overrides)
      : getRecommendationSet(dominantVariable, riskLevel)

    // ── 3. Persist to recommendation_log (immutable — EU AI Act Art. 12) ─────
    const { data: logEntry, error: logError } = await supabase
      .from('recommendation_log')
      .insert({
        score_history_id:    scoreHistoryId ?? null,
        athlete_id:          athleteId,
        org_id:              orgId,
        risk_level:          riskLevel,
        dominant_variable:   dominantVariable,
        confidence:          confidence,
        model_version:       modelVersion,
        clinical_recs:       recommendations.clinical,
        athlete_recs:        recommendations.athlete,
        coach_recs:          recommendations.coach,
        generated_by:        `scoring_engine_v${modelVersion}`,
        org_config_snapshot: orgConfigSnapshot,
      })
      .select('id')
      .single()

    if (logError) {
      console.error('[recommendations] Failed to persist to log:', logError)
      // Return recommendations even if logging fails — don't block UI
      return { recommendations, logId: null, error: logError.message }
    }

    return { recommendations, logId: logEntry.id }

  } catch (err) {
    console.error('[recommendations] Unexpected error:', err)
    // Graceful fallback — return base recommendations without org overrides
    const fallback = getRecommendationSet(dominantVariable, riskLevel)
    return { recommendations: fallback, logId: null, error: String(err) }
  }
}

/**
 * Acknowledge recommendations as seen by clinical staff.
 * Non-destructive — only writes timestamp + user to existing log entry.
 */
export async function acknowledgeRecommendations(
  logId: string,
  stakeholder: 'clinical' | 'coach',
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const now = new Date().toISOString()
  const update = stakeholder === 'clinical'
    ? { clinical_acknowledged_at: now, clinical_acknowledged_by: user.id }
    : { coach_acknowledged_at: now, coach_acknowledged_by: user.id }

  const { error } = await supabase
    .from('recommendation_log')
    .update(update)
    .eq('id', logId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Fetch the latest recommendation log entry for an athlete.
 * Used by the main app to display current recommendations.
 */
export async function getLatestRecommendations(
  athleteId: string,
): Promise<(RecommendationSet & { logId: string; generatedAt: string; acknowledged: { clinical: boolean; coach: boolean } }) | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recommendation_log')
    .select('id, clinical_recs, athlete_recs, coach_recs, generated_at, clinical_acknowledged_at, coach_acknowledged_at')
    .eq('athlete_id', athleteId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return {
    logId:       data.id,
    generatedAt: data.generated_at,
    clinical:    data.clinical_recs  ?? [],
    athlete:     data.athlete_recs   ?? [],
    coach:       data.coach_recs     ?? [],
    acknowledged: {
      clinical: !!data.clinical_acknowledged_at,
      coach:    !!data.coach_acknowledged_at,
    },
  }
}
