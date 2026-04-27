// ─────────────────────────────────────────────────────────────────
// AURA — Scoring Engine v1.1
// Mirrors the exact model from the HTML demo
// ─────────────────────────────────────────────────────────────────

import type {
  AthleteScore, Confidence, MenstrualPhase,
  ReadinessResult, ReadinessIndicator, CalendarSnapshot,
  FatigueProfile
} from '@/types'

// Model weights v1.1 (loaded from DB; these are defaults)
export const DEFAULT_WEIGHTS: Record<string, number> = {
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

// ─── Normalisation functions (0=low risk, 1=high risk) ───────────

export type NormInputs = {
  history?: number | null    // 0,1,2
  acwr?: number | null       // ratio
  hrv?: number | null        // delta % from baseline
  fatigue?: number | null    // 1-7
  sleep?: number | null      // hours
  tqr?: number | null        // 6-20
  stress?: number | null     // 0-10
  decel?: number | null      // ACWR of decelerations
  md?: number | null         // days since last match
}

function norm(key: string, val: number | null | undefined): number | null {
  if (val == null) return null

  switch (key) {
    case 'history':
      return val === 0 ? 0 : val === 1 ? 0.45 : 1.0

    case 'acwr':
      if (val < 0.8)  return 0.15
      if (val < 1.0)  return 0.10
      if (val < 1.3)  return 0.0
      if (val < 1.5)  return 0.55
      if (val < 1.8)  return 0.80
      return 1.0

    case 'hrv':
      if (val >= 5)    return 0.0
      if (val >= -5)   return 0.10
      if (val >= -10)  return 0.30
      if (val >= -20)  return 0.65
      return 1.0

    case 'fatigue':
      return Math.max(0, Math.min(1, (val - 1) / 6))

    case 'sleep':
      if (val >= 8)   return 0.0
      if (val >= 7)   return 0.15
      if (val >= 6)   return 0.45
      if (val >= 5)   return 0.75
      return 1.0

    case 'tqr':
      return Math.max(0, Math.min(1, 1 - (val - 6) / 14))

    case 'stress':
      return val / 10

    case 'decel':
      if (val < 0.8)  return 0.10
      if (val < 1.3)  return 0.0
      if (val < 1.5)  return 0.55
      if (val < 1.8)  return 0.80
      return 1.0

    case 'md':
      if (val >= 4)  return 0.0
      if (val === 3) return 0.20
      if (val === 2) return 0.45
      if (val === 1) return 0.70
      return 0.90  // MD+0 = match day

    default:
      return null
  }
}

// ─── Main scoring function ────────────────────────────────────────

export function calcScore(
  inputs: NormInputs,
  weights: Record<string, number> = DEFAULT_WEIGHTS
): AthleteScore {
  const partials: Record<string, number | null> = {}
  const missing: string[] = []
  let scoreSum = 0
  let weightSum = 0
  let nAvail = 0

  for (const [k, w] of Object.entries(weights)) {
    const p = norm(k, (inputs as Record<string, number | null | undefined>)[k])
    partials[k] = p
    if (p !== null) {
      scoreSum += p * w
      weightSum += w
      nAvail++
    } else {
      missing.push(k)
    }
  }

  const score = weightSum > 0 ? Math.round((scoreSum / weightSum) * 100) : 0

  // Effective weights after redistribution
  const effectiveWeights: Record<string, number> = {}
  for (const [k, w] of Object.entries(weights)) {
    effectiveWeights[k] =
      partials[k] !== null && weightSum > 0
        ? parseFloat((w / weightSum).toFixed(3))
        : 0
  }

  // Confidence
  const hasACWR = inputs.acwr != null
  const hasHRV  = inputs.hrv  != null
  let confidence: Confidence
  let confidenceReason: string

  if (nAvail >= 7 && hasACWR && hasHRV) {
    confidence = 'high'
    confidenceReason = `${nAvail}/9 variáveis · ACWR presente · HRV presente`
  } else if (nAvail >= 4) {
    confidence = 'medium'
    const reasons: string[] = []
    if (!hasACWR) reasons.push('ACWR ausente')
    if (!hasHRV)  reasons.push('HRV ausente')
    if (nAvail < 7) reasons.push(`apenas ${nAvail}/9 variáveis`)
    confidenceReason = reasons.join(' · ')
  } else {
    confidence = 'low'
    confidenceReason = `apenas ${nAvail}/9 variáveis disponíveis`
  }

  // Dominant variable
  let dominantVariable: string | null = null
  let domScore = -1
  for (const [k] of Object.entries(weights)) {
    const p = partials[k]
    const ew = effectiveWeights[k]
    if (p !== null && p * ew > domScore) {
      domScore = p * ew
      dominantVariable = k
    }
  }

  return {
    score,
    confidence,
    confidence_reason: confidenceReason,
    dominant_variable: dominantVariable,
    n_variables: nAvail,
    missing,
    partials,
    effective_weights: effectiveWeights,
  }
}

// ─── Risk level helpers ───────────────────────────────────────────

export function riskColor(score: number): string {
  if (score < 40) return '#00e5a0'
  if (score < 65) return '#ffb347'
  if (score < 85) return '#ff7043'
  return '#ff4d6d'
}

export function riskLabel(score: number): string {
  if (score < 40) return 'Baixo'
  if (score < 65) return 'Moderado'
  if (score < 85) return 'Alto'
  return 'Crítico'
}

export function riskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score < 40) return 'low'
  if (score < 65) return 'medium'
  if (score < 85) return 'high'
  return 'critical'
}

// ─── Menstrual cycle ─────────────────────────────────────────────

export function getMenstrualPhase(day: number, cycleLength = 28): MenstrualPhase {
  if (day <= 5) return {
    phase: 'menstrual', label: 'Fase menstrual', color: '#ff4d6d',
    lca_risk: 1.1, note: 'Dor possível. Monitorizar intensidade.'
  }
  if (day <= 13) return {
    phase: 'follicular', label: 'Fase folicular', color: '#00e5a0',
    lca_risk: 1.0, note: 'Fase de maior resiliência. Ideal para carga alta.'
  }
  if (day === 14) return {
    phase: 'ovulatory', label: 'Ovulação', color: '#ff7043',
    lca_risk: 1.4, note: 'Pico estrogénio: risco LCA +40%. Evitar arranques bruscos.'
  }
  return {
    phase: 'luteal', label: 'Fase lútea', color: '#ffb347',
    lca_risk: 1.2, note: 'Maior laxidez ligamentar. Reforço proprioceptivo recomendado.'
  }
}

export function getFemaleAdjustedScore(score: number, menstrualDay: number, cycleLength = 28) {
  const phase = getMenstrualPhase(menstrualDay, cycleLength)
  return {
    adjusted: Math.min(99, Math.round(score * phase.lca_risk)),
    base: score,
    phase,
  }
}

// ─── Readiness panel ─────────────────────────────────────────────

export function getReadiness(
  athlete: {
    wellness?: { hrv_ms?: number | null; fatigue?: number | null; sleep_hours?: number | null; tqr?: number | null } | null
    perf?: { vmax_today_pct?: number | null } | null
    md?: number | null
    hrv_baseline_ms?: number | null
  }
): ReadinessResult {
  const indicators: ReadinessIndicator[] = []

  // 1. HRV — compare to passport baseline if available
  const hrv_ms = athlete.wellness?.hrv_ms ?? null
  const baseline_hrv = athlete.hrv_baseline_ms ?? 65
  if (hrv_ms != null) {
    const delta_pct = ((hrv_ms - baseline_hrv) / baseline_hrv) * 100
    const status: ReadinessIndicator['status'] =
      delta_pct >= -5 ? 'green' : delta_pct >= -15 ? 'amber' : 'red'
    indicators.push({ label: 'HRV', status, value: `${delta_pct > 0 ? '+' : ''}${delta_pct.toFixed(0)}%` })
  } else {
    indicators.push({ label: 'HRV', status: 'grey', value: 'N/D' })
  }

  // 2. MD+n
  const md = athlete.md
  if (md != null) {
    const status: ReadinessIndicator['status'] = md >= 4 ? 'green' : md >= 2 ? 'amber' : 'red'
    indicators.push({ label: 'MD+n', status, value: `MD+${md}` })
  } else {
    indicators.push({ label: 'MD+n', status: 'grey', value: 'N/D' })
  }

  // 3. Vmax%
  const vmaxPct = athlete.perf?.vmax_today_pct ?? null
  if (vmaxPct != null) {
    const status: ReadinessIndicator['status'] =
      vmaxPct >= 90 ? 'green' : vmaxPct >= 80 ? 'amber' : 'red'
    indicators.push({ label: 'Vmax%', status, value: `${vmaxPct}%` })
  } else {
    indicators.push({ label: 'Vmax%', status: 'grey', value: 'N/D' })
  }

  // 4. Wellness composite
  const fatigue = athlete.wellness?.fatigue ?? null
  const sleep   = athlete.wellness?.sleep_hours ?? null
  const tqr     = athlete.wellness?.tqr ?? null
  let wellScore = 0, wellCount = 0
  if (fatigue != null) { wellScore += fatigue <= 4 ? 2 : fatigue <= 6 ? 1 : 0; wellCount++ }
  if (sleep   != null) { wellScore += sleep   >= 7 ? 2 : sleep   >= 6 ? 1 : 0; wellCount++ }
  if (tqr     != null) { wellScore += tqr     >= 14 ? 2 : tqr    >= 10 ? 1 : 0; wellCount++ }
  if (wellCount > 0) {
    const pct = wellScore / (wellCount * 2)
    const status: ReadinessIndicator['status'] =
      pct >= 0.75 ? 'green' : pct >= 0.4 ? 'amber' : 'red'
    const label = pct >= 0.75 ? 'Boa' : pct >= 0.4 ? 'Moderada' : 'Baixa'
    indicators.push({ label: 'Wellness', status, value: label })
  } else {
    indicators.push({ label: 'Wellness', status: 'grey', value: 'N/D' })
  }

  // Overall: worst indicator drives result
  const order = { red: 0, amber: 1, green: 2, grey: 3 }
  const nGrey = indicators.filter(i => i.status === 'grey').length
  let overall: ReadinessResult['overall'] = 'green'
  if (nGrey >= 3) {
    overall = 'grey'
  } else {
    for (const ind of indicators) {
      if (ind.status !== 'grey' && order[ind.status] < order[overall]) {
        overall = ind.status as ReadinessResult['overall']
      }
    }
  }

  return { indicators, overall }
}

// ─── Calendar Intelligence ────────────────────────────────────────

const RISK_BASELINE = 22

export function projectScore(
  currentScore: number,
  events: Array<{ event_type: string | null; intensity: string | null }>,
  profile: Partial<FatigueProfile> = {}
): CalendarSnapshot[] {
  const recoverySpeed         = profile.recovery_speed         ?? 1.0
  const congestionSensitivity = profile.congestion_sensitivity ?? 1.0
  const md1Drop               = profile.typical_md1_drop        ?? 14

  const snapshots: CalendarSnapshot[] = [{ pre: currentScore, post: currentScore }]
  let lastScore = currentScore
  let matchFatigue = 0

  for (const ev of events) {
    const preScore = lastScore
    matchFatigue *= 0.80 // decay ~22%/day

    let delta = 0

    if (ev.event_type === 'match') {
      const congestionFactor = 1 + (matchFatigue / 20) * congestionSensitivity
      const matchImpact = md1Drop * congestionSensitivity * congestionFactor
      matchFatigue += matchImpact * 0.9
      delta = matchImpact

    } else if (ev.event_type === 'training') {
      const intensity = ev.intensity ?? 'medium'
      if (intensity === 'low') {
        delta = -(lastScore - RISK_BASELINE) * 0.07 * recoverySpeed
      } else if (intensity === 'medium') {
        delta = 3 * congestionSensitivity
      } else if (intensity === 'high') {
        delta = 7 * congestionSensitivity
      } else { // max
        delta = 13 * congestionSensitivity
      }

    } else {
      // rest / travel
      const dist = Math.max(0, lastScore - RISK_BASELINE)
      const baseRecovery  = dist * 0.20 * recoverySpeed
      const fatigueBonus  = matchFatigue * 0.08 * recoverySpeed
      delta = -(baseRecovery + fatigueBonus)
    }

    const postScore = Math.max(RISK_BASELINE, Math.min(99, lastScore + delta))
    snapshots.push({ pre: Math.round(preScore), post: Math.round(postScore) })
    lastScore = postScore
  }

  return snapshots
}

// ─── Formatting helpers ────────────────────────────────────────────

export const VAR_LABELS: Record<string, string> = {
  history: 'Historial lesões',
  acwr:    'ACWR GPS',
  hrv:     'HRV Δ baseline',
  fatigue: 'Fadiga (Hooper)',
  sleep:   'Sono',
  tqr:     'TQR',
  stress:  'Stress percebido',
  decel:   'Desacelerações ACWR',
  md:      'Dias desde jogo',
}

export const VAR_ICONS: Record<string, string> = {
  history: '📋', acwr: '📡', hrv: '💓', fatigue: '😴',
  sleep: '🌙', tqr: '⚡', stress: '🧠', decel: '📉', md: '📅',
}

export function formatScore(score: number) {
  return `${score}%`
}

export function confidenceLabel(c: Confidence) {
  return { high: 'Alta confiança', medium: 'Confiança média', low: 'Confiança baixa' }[c]
}
