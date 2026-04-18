// Scoring engine — server-side implementation
// Port of calcScore() from Aura_Demo_FPF.html
// Architecture doc §3: "scoring corre no servidor, nunca no cliente"
//
// Phase 1 weights (v1.1) — expert-defined, literature-based
// Phase 2 (≥30 injury events): weights replaced by logistic regression

import type { ScoreInputs, ScoreResult, ScoreWeights, RiskLevel, Confidence } from '@/types'
import { normalizeInputs } from './normalization'

export const BASE_WEIGHTS_V1: ScoreWeights = {
  history: 0.20,
  acwr:    0.20,
  hrv:     0.18,
  fatigue: 0.13,
  sleep:   0.12,
  tqr:     0.07,
  stress:  0.04,
  decel:   0.04,
  md:      0.02,
}

export function riskLevel(score: number): RiskLevel {
  if (score < 40)  return 'low'
  if (score < 65)  return 'medium'
  if (score < 85)  return 'high'
  return 'critical'
}

function assessConfidence(
  inputs: ScoreInputs,
  nAvailable: number
): { confidence: Confidence; reason: string } {
  const hasAcwr = inputs.acwr !== null
  const hasHrv  = inputs.hrv  !== null
  const missing: string[] = []

  if (!hasAcwr) missing.push('ACWR')
  if (!hasHrv)  missing.push('HRV')

  if (nAvailable >= 7 && hasAcwr && hasHrv) {
    return { confidence: 'high', reason: 'Todos os indicadores-chave disponíveis' }
  }
  if (nAvailable >= 4) {
    const reason = missing.length
      ? `Dados em falta: ${missing.join(', ')}. Score indicativo.`
      : 'Dados parciais — screening recomendado'
    return { confidence: 'medium', reason }
  }
  return {
    confidence: 'low',
    reason: 'Menos de 4 variáveis disponíveis — protocolo de chegada necessário',
  }
}

export function calculateScore(
  inputs: ScoreInputs,
  weights: ScoreWeights = BASE_WEIGHTS_V1
): ScoreResult {
  const partials = normalizeInputs(inputs)
  const vars = Object.keys(weights) as (keyof ScoreInputs)[]

  // Only use variables with actual data
  const available = vars.filter(k => partials[k] !== null)
  const missing   = vars.filter(k => partials[k] === null) as (keyof ScoreInputs)[]
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

  // Find dominant variable (highest partial contribution)
  let dominantVariable: keyof ScoreInputs = 'acwr'
  let maxContrib = -1
  for (const k of available) {
    const contrib = (partials[k] as number) * effectiveWeights[k]
    if (contrib > maxContrib) {
      maxContrib = contrib
      dominantVariable = k
    }
  }

  const { confidence, reason } = assessConfidence(inputs, nAvailable)

  return {
    score,
    riskLevel: riskLevel(score),
    confidence,
    confidenceReason: reason,
    dominantVariable,
    partials,
    effectiveWeights,
    missing,
    nAvailable,
  }
}

// Convenience: compute score from 0–1 to display percentage
export function scoreToPercent(score: number): number {
  return Math.round(score * 100)
}
