// Readiness scoring engine — server-side implementation
// Mirrors the architecture of lib/scoring/engine.ts exactly.
//
// Model v1 weights (expert-defined, literature-based):
//   HRV delta   0.25  Plews et al. 2013
//   Sleep       0.20  Skein et al. 2011
//   Fatigue     0.18  Hooper & Mackinnon 1995
//   DOMS        0.12  Hooper & Mackinnon 1995
//   Stress      0.10  Hooper & Mackinnon 1995
//   TQR         0.10  Kenttä & Hassmén 1998
//   MD+n        0.05  Ekstrand et al. 2011
//
// Score 0–100: higher = less ready (more impaired)
// Levels: green < 30 | amber 30–54 | red ≥ 55

import type {
  ReadinessInputs,
  ReadinessScore,
  ReadinessWeights,
  ReadinessPartials,
  ReadinessLevel,
  Confidence,
} from '@/types'
import { normalizeReadinessInputs } from './normalization.ts'

export const READINESS_WEIGHTS_V1: ReadinessWeights = {
  hrv:     0.25,
  sleep:   0.20,
  fatigue: 0.18,
  doms:    0.12,
  stress:  0.10,
  tqr:     0.10,
  md:      0.05,
}

export function readinessLevel(score: number): ReadinessLevel {
  if (score < 30) return 'green'
  if (score < 55) return 'amber'
  return 'red'
}

function assessReadinessConfidence(
  inputs: ReadinessInputs,
  nAvailable: number
): { confidence: Confidence; reason: string } {
  const hasHrv   = inputs.hrv_delta_pct !== null
  const hasSleep = inputs.sleep_hours   !== null
  const missing: string[] = []

  if (!hasHrv)   missing.push('HRV')
  if (!hasSleep) missing.push('Sono')

  if (nAvailable >= 5 && hasHrv && hasSleep) {
    return { confidence: 'high', reason: 'Todos os indicadores de prontidão disponíveis' }
  }
  if (nAvailable >= 3) {
    const reason = missing.length
      ? `Dados em falta: ${missing.join(', ')}. Prontidão indicativa.`
      : 'Dados parciais — verificação recomendada'
    return { confidence: 'medium', reason }
  }
  return {
    confidence: 'low',
    reason: 'Menos de 3 variáveis disponíveis — check-in matinal necessário',
  }
}

export function calculateReadiness(
  inputs: ReadinessInputs,
  weights: ReadinessWeights = READINESS_WEIGHTS_V1
): ReadinessScore {
  const partials = normalizeReadinessInputs(inputs)
  const vars = Object.keys(weights) as (keyof ReadinessWeights)[]

  // Only use variables with actual data
  const available = vars.filter((k) => partials[k] !== null)
  const missing   = vars.filter((k) => partials[k] === null) as (keyof ReadinessPartials)[]
  const nAvailable = available.length

  // Redistribute weights from missing variables proportionally
  const totalBaseWeight = available.reduce((sum, k) => sum + weights[k], 0)
  const effectiveWeights = { ...weights }
  if (totalBaseWeight > 0 && totalBaseWeight < 1) {
    for (const k of available) {
      effectiveWeights[k] = weights[k] / totalBaseWeight
    }
  }

  // Weighted sum
  let rawScore = 0
  for (const k of available) {
    rawScore += (partials[k] as number) * effectiveWeights[k]
  }

  const score = Math.round(rawScore * 100)

  // Dominant variable (highest partial × effective weight contribution)
  let dominantVariable: keyof ReadinessPartials = 'fatigue'
  let maxContrib = -1
  for (const k of available) {
    const contrib = (partials[k] as number) * effectiveWeights[k]
    if (contrib > maxContrib) {
      maxContrib = contrib
      dominantVariable = k
    }
  }

  const { confidence, reason } = assessReadinessConfidence(inputs, nAvailable)

  return {
    score,
    level: readinessLevel(score),
    confidence,
    confidenceReason: reason,
    dominantVariable,
    partials,
    effectiveWeights,
    missing,
    nAvailable,
  }
}
