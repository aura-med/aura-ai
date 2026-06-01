/**
 * predict-risk — Supabase Edge Function (Deno runtime)
 *
 * SECURE IP VAULT: All proprietary coefficients are read exclusively from
 * server-side environment variables. They are NEVER returned to the client.
 *
 * Deploy: supabase functions deploy predict-risk --no-verify-jwt
 * Secrets: supabase secrets set W_HISTORY=0.20 W_ACWR=0.20 W_HRV=0.18 \
 *            W_FATIGUE=0.13 W_SLEEP=0.12 W_TQR=0.07 W_STRESS=0.04 \
 *            W_DECEL=0.04 W_MD=0.02
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Metrics {
  history?: number | null
  acwr?: number | null
  hrv?: number | null
  fatigue?: number | null
  sleep?: number | null
  tqr?: number | null
  stress?: number | null
  decel?: number | null
  md?: number | null
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type Confidence = 'high' | 'medium' | 'low'

// ── Normalisation (mirrored from lib/scoring/normalization.ts — server-only) ─

function clamp(v: number): number { return Math.max(0, Math.min(1, v)) }

const normalise: Record<keyof Metrics, (v: number) => number> = {
  history: (v) => v <= 0 ? 0 : v === 1 ? 0.5 : 1.0,
  acwr:    (v) => v <= 0.8 ? 0 : v >= 1.5 ? 1 : clamp((v - 0.8) / 0.7),
  hrv:     (v) => v >= -5 ? 0 : v <= -30 ? 1 : clamp((-v - 5) / 25),
  fatigue: (v) => v <= 4 ? 0 : v >= 7 ? 1 : clamp((v - 4) / 3),
  sleep:   (v) => v >= 7 ? 0 : v <= 5 ? 1 : clamp((7 - v) / 2),
  tqr:     (v) => v >= 14 ? 0 : v <= 9 ? 1 : clamp((14 - v) / 5),
  stress:  (v) => v <= 4 ? 0 : v >= 7 ? 1 : clamp((v - 4) / 3),
  decel:   (v) => v <= 0.8 ? 0 : v >= 1.5 ? 1 : clamp((v - 0.8) / 0.7),
  md:      (v) => v >= 4 ? 0 : v <= 1 ? 1 : clamp((4 - v) / 3),
}

// ── Insight generator ─────────────────────────────────────────────────────────

const INSIGHT_TEMPLATES: Record<keyof Metrics, (partial: number) => string> = {
  history: (p) => p > 0.5
    ? 'Risco elevado por historial de lesão no mesmo segmento (recidiva).'
    : 'Historial de lesão sem impacto significativo.',
  acwr:    (p) => p > 0.6
    ? 'Pico agudo de carga (ACWR > 1.3) — risco de overuse imediato.'
    : 'Carga de treino dentro dos limites seguros.',
  hrv:     (p) => p > 0.5
    ? 'HRV abaixo do baseline — recuperação incompleta do SNA.'
    : 'Variabilidade cardíaca dentro dos parâmetros normais.',
  fatigue: (p) => p > 0.6
    ? 'Fadiga Hooper elevada — risco acrescido de lesão por musculatura comprometida.'
    : 'Níveis de fadiga aceitáveis.',
  sleep:   (p) => p > 0.5
    ? 'Privação de sono detectada — OR de lesão aumentado (meta-análise 2025).'
    : 'Qualidade de sono adequada.',
  tqr:     (p) => p > 0.5
    ? 'Recuperação percebida baixa (TQR) — atleta pode estar sub-recuperado.'
    : 'Recuperação percebida dentro do esperado.',
  stress:  (p) => p > 0.5
    ? 'Stress psicológico elevado — fator de risco secundário identificado.'
    : 'Stress psicológico não preocupante.',
  decel:   (p) => p > 0.6
    ? 'ACWR de desacelerações elevado — carga excêntrica acumulada excessiva.'
    : 'Carga excêntrica controlada.',
  md:      (p) => p > 0.5
    ? 'Jogo recente (MD+1/MD+2) — recuperação pós-match incompleta.'
    : 'Dias suficientes desde o último jogo.',
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const metrics: Metrics = body?.metrics ?? {}

    // ── Read proprietary weights from secure env (never sent to client) ──────
    const weights: Record<keyof Metrics, number> = {
      history: Number(Deno.env.get('W_HISTORY') ?? '0.20'),
      acwr:    Number(Deno.env.get('W_ACWR')    ?? '0.20'),
      hrv:     Number(Deno.env.get('W_HRV')     ?? '0.18'),
      fatigue: Number(Deno.env.get('W_FATIGUE') ?? '0.13'),
      sleep:   Number(Deno.env.get('W_SLEEP')   ?? '0.12'),
      tqr:     Number(Deno.env.get('W_TQR')     ?? '0.07'),
      stress:  Number(Deno.env.get('W_STRESS')  ?? '0.04'),
      decel:   Number(Deno.env.get('W_DECEL')   ?? '0.04'),
      md:      Number(Deno.env.get('W_MD')      ?? '0.02'),
    }

    // ── Normalise available inputs ────────────────────────────────────────────
    const partials: Partial<Record<keyof Metrics, number>> = {}
    const available: (keyof Metrics)[] = []

    for (const key of Object.keys(weights) as (keyof Metrics)[]) {
      const raw = metrics[key]
      if (raw !== null && raw !== undefined) {
        partials[key] = normalise[key](raw)
        available.push(key)
      }
    }

    if (available.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No metrics provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Redistribute weights proportionally for missing variables ─────────────
    const totalBase = available.reduce((sum, k) => sum + weights[k], 0)
    const effectiveWeights = { ...weights }
    if (totalBase > 0 && totalBase < 1) {
      for (const k of available) {
        effectiveWeights[k] = weights[k] / totalBase
      }
    }

    // ── Compute weighted score ────────────────────────────────────────────────
    let rawScore = 0
    let dominantVariable: keyof Metrics = 'acwr'
    let maxContrib = -1

    for (const k of available) {
      const contrib = (partials[k] as number) * effectiveWeights[k]
      rawScore += contrib
      if (contrib > maxContrib) {
        maxContrib = contrib
        dominantVariable = k
      }
    }

    const score = Math.round(rawScore * 100)

    // ── Risk level ────────────────────────────────────────────────────────────
    const riskLevel: RiskLevel =
      score < 40 ? 'low' :
      score < 65 ? 'medium' :
      score < 85 ? 'high' : 'critical'

    // ── Confidence ────────────────────────────────────────────────────────────
    const hasAcwr = metrics.acwr !== null && metrics.acwr !== undefined
    const hasHrv  = metrics.hrv  !== null && metrics.hrv  !== undefined
    const confidence: Confidence =
      available.length >= 7 && hasAcwr && hasHrv ? 'high' :
      available.length >= 4 ? 'medium' : 'low'

    // ── Insight string (qualitative, derived from dominant variable) ──────────
    const dominantPartial = partials[dominantVariable] ?? 0
    const insight = INSIGHT_TEMPLATES[dominantVariable](dominantPartial)

    // ── Response — weights are NOT included ───────────────────────────────────
    return new Response(
      JSON.stringify({ score, riskLevel, confidence, insight, dominantVariable }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[predict-risk]', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
