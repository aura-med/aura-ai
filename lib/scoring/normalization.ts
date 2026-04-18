// Normalization functions — port of norm() from Aura_Demo_FPF.html
// Each function maps a raw value to 0.0 (normal) → 1.0 (critical risk)
// Thresholds from architecture doc v1.1 + Aura_Algoritmo_v1.1.html

import type { ScoreInputs, ScorePartials } from '@/types'

function clamp(val: number): number {
  return Math.max(0, Math.min(1, val))
}

// History: injury recurrence in same segment
// 0 episodes → 0, 1 episode → 0.5, ≥2 same segment → 1.0
function normHistory(val: number): number {
  if (val <= 0) return 0
  if (val === 1) return 0.5
  return 1.0
}

// ACWR (EWMA): 0.8–1.3 = normal, 1.3–1.5 = alert, >1.5 = critical
function normAcwr(val: number): number {
  if (val <= 0.8) return 0
  if (val >= 1.5) return 1.0
  return clamp((val - 0.8) / (1.5 - 0.8))
}

// HRV Δ baseline (%): > −5% normal, −5% to −30% → critical
// Negative delta = more at risk; val is already a % (e.g. −22 means 22% below)
function normHrv(val: number): number {
  if (val >= -5) return 0
  if (val <= -30) return 1.0
  return clamp((val * -1 - 5) / (30 - 5))
}

// Fatigue (Hooper 1–7): ≤4 normal, ≥7 critical
function normFatigue(val: number): number {
  if (val <= 4) return 0
  if (val >= 7) return 1.0
  return clamp((val - 4) / (7 - 4))
}

// Sleep hours: ≥7h normal, ≤5h critical (inverted scale)
function normSleep(val: number): number {
  if (val >= 7) return 0
  if (val <= 5) return 1.0
  return clamp((7 - val) / (7 - 5))
}

// TQR (6–20): ≥14 normal, ≤9 critical (inverted scale)
function normTqr(val: number): number {
  if (val >= 14) return 0
  if (val <= 9) return 1.0
  return clamp((14 - val) / (14 - 9))
}

// Stress (1–10): ≤4 normal, ≥7 critical
function normStress(val: number): number {
  if (val <= 4) return 0
  if (val >= 7) return 1.0
  return clamp((val - 4) / (7 - 4))
}

// Decel ACWR: same thresholds as ACWR
function normDecel(val: number): number {
  return normAcwr(val)
}

// MD+n (days since last match): ≥4 days normal, MD+1 critical
function normMd(val: number): number {
  if (val >= 4) return 0
  if (val <= 1) return 1.0
  return clamp((4 - val) / (4 - 1))
}

// ─── Main normalizer ───────────────────────────────────────────────────────

export const NORMALIZERS: Record<keyof ScoreInputs, (val: number) => number> = {
  history: normHistory,
  acwr:    normAcwr,
  hrv:     normHrv,
  fatigue: normFatigue,
  sleep:   normSleep,
  tqr:     normTqr,
  stress:  normStress,
  decel:   normDecel,
  md:      normMd,
}

export function normalizeInputs(inputs: ScoreInputs): ScorePartials {
  const partials: Partial<ScorePartials> = {}
  for (const key of Object.keys(NORMALIZERS) as (keyof ScoreInputs)[]) {
    const val = inputs[key]
    partials[key] = val !== null && val !== undefined ? NORMALIZERS[key](val) : null
  }
  return partials as ScorePartials
}
