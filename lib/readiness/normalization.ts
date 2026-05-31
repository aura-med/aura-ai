// Readiness normalization functions
// Each function maps a raw measurement to 0.0 (no impairment) → 1.0 (fully impaired)
// Evidence refs in lib/readiness/engine.ts

import type { ReadinessInputs, ReadinessPartials } from '@/types'

function clamp(val: number): number {
  return Math.max(0, Math.min(1, val))
}

// HRV delta from individual baseline (fractional: e.g. -0.22 = 22% below)
// |Δ| < 5%  → 0.0 (within normal day-to-day variation)
// |Δ| > 30% → 1.0 (critical autonomic suppression)
// Ref: Plews et al. 2013
export function normHrvDelta(delta_frac: number): number {
  return clamp((Math.abs(delta_frac) - 0.05) / 0.25)
}

// Sleep composite: combines duration and quality
// sleep_hours: target ≥ 7h; < 5.5h → fully impaired
// sleep_quality: 1–5 scale (higher = better); ≤ 1 → fully impaired, ≥ 3 → no contribution
// Ref: Skein et al. 2011
export function normSleep(sleep_hours: number, sleep_quality: number): number {
  const hours_score = clamp((7 - sleep_hours) / 1.5)
  const qual_score  = clamp((3 - sleep_quality) / 2)
  return (hours_score + qual_score) / 2
}

// Sleep from hours only (fallback when quality is missing)
export function normSleepHoursOnly(sleep_hours: number): number {
  return clamp((7 - sleep_hours) / 1.5)
}

// Hooper sub-scales: fatigue, DOMS, stress (1–7)
// ≤ 2 → 0.0 (no impairment), ≥ 7 → 1.0 (maximum)
// Ref: Hooper & Mackinnon 1995
export function normHooper(val: number): number {
  return clamp((val - 2) / 5)
}

// TQR recovery score (6–20); higher = better recovery (inverted scale)
// ≥ 14 → 0.0 (fully recovered), ≤ 6 → 1.0 (not recovered)
// Ref: Kenttä & Hassmén 1998
export function normTqr(val: number): number {
  return clamp((14 - val) / 8)
}

// MD+n lookup table (days since last competitive match)
// Ref: Ekstrand et al. 2011 — injury incidence peaks MD+1, normalises by MD+5
const MD_MAP: readonly number[] = [1.0, 0.85, 0.55, 0.25, 0.10, 0.0, 0.0, 0.0]

export function normMd(days: number): number {
  return MD_MAP[Math.min(Math.max(0, Math.round(days)), 7)]
}

// ── Main normalizer ──────────────────────────────────────────────────────────

export function normalizeReadinessInputs(inputs: ReadinessInputs): ReadinessPartials {
  let sleep: number | null = null
  if (inputs.sleep_hours !== null && inputs.sleep_quality !== null) {
    sleep = normSleep(inputs.sleep_hours, inputs.sleep_quality)
  } else if (inputs.sleep_hours !== null) {
    sleep = normSleepHoursOnly(inputs.sleep_hours)
  }

  return {
    hrv:     inputs.hrv_delta_pct !== null ? normHrvDelta(inputs.hrv_delta_pct) : null,
    sleep,
    fatigue: inputs.fatigue  !== null ? normHooper(inputs.fatigue)  : null,
    doms:    inputs.doms     !== null ? normHooper(inputs.doms)     : null,
    stress:  inputs.stress   !== null ? normHooper(inputs.stress)   : null,
    tqr:     inputs.tqr      !== null ? normTqr(inputs.tqr)         : null,
    md:      inputs.md_plus  !== null ? normMd(inputs.md_plus)      : null,
  }
}
