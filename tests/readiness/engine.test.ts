import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateReadiness,
  readinessLevel,
  READINESS_WEIGHTS_V1,
} from '../../lib/readiness/engine.ts'
import type { ReadinessInputs } from '../../types/index.ts'

const FULL_INPUTS: ReadinessInputs = {
  hrv_delta_pct: 0,
  sleep_hours:   8,
  sleep_quality: 5,
  fatigue:       1,
  doms:          1,
  stress:        1,
  tqr:           18,
  md_plus:       5,
}

const WORST_INPUTS: ReadinessInputs = {
  hrv_delta_pct: -0.40,
  sleep_hours:   4,
  sleep_quality: 1,
  fatigue:       7,
  doms:          7,
  stress:        7,
  tqr:           6,
  md_plus:       0,
}

// ── readinessLevel ───────────────────────────────────────────────────────────

test('readinessLevel bands: <30 green, 30–54 amber, ≥55 red', () => {
  assert.equal(readinessLevel(0),  'green')
  assert.equal(readinessLevel(29), 'green')
  assert.equal(readinessLevel(30), 'amber')
  assert.equal(readinessLevel(54), 'amber')
  assert.equal(readinessLevel(55), 'red')
  assert.equal(readinessLevel(100),'red')
})

// ── calculateReadiness: score range ─────────────────────────────────────────

test('full optimal inputs → score near 0, level green', () => {
  const r = calculateReadiness(FULL_INPUTS)
  assert.ok(r.score >= 0 && r.score <= 10, `expected ~0 got ${r.score}`)
  assert.equal(r.level, 'green')
})

test('worst-case inputs → score near 100, level red', () => {
  const r = calculateReadiness(WORST_INPUTS)
  assert.ok(r.score >= 85, `expected ≥85 got ${r.score}`)
  assert.equal(r.level, 'red')
})

test('score is always 0–100', () => {
  for (const inputs of [FULL_INPUTS, WORST_INPUTS]) {
    const r = calculateReadiness(inputs)
    assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score} out of bounds`)
  }
})

// ── calculateReadiness: missing data / weight redistribution ─────────────────

test('all-null inputs → score 0, low confidence, 0 available', () => {
  const r = calculateReadiness({
    hrv_delta_pct: null, sleep_hours: null, sleep_quality: null,
    fatigue: null, doms: null, stress: null, tqr: null, md_plus: null,
  })
  assert.equal(r.score, 0)
  assert.equal(r.nAvailable, 0)
  assert.equal(r.confidence, 'low')
})

test('single variable available → effective weight sums to 1', () => {
  const r = calculateReadiness({
    hrv_delta_pct: -0.20,
    sleep_hours: null, sleep_quality: null,
    fatigue: null, doms: null, stress: null, tqr: null, md_plus: null,
  })
  assert.equal(r.nAvailable, 1)
  const totalEff = Object.values(r.effectiveWeights).reduce((a, b) => a + b, 0)
  // Available variables' effective weight should sum to 1
  assert.ok(Math.abs(r.effectiveWeights.hrv - 1.0) < 0.001, `hrv eff weight should be 1, got ${r.effectiveWeights.hrv}`)
  assert.ok(totalEff >= 1, `total effective weight ${totalEff} should be ≥ 1`)
})

test('missing HRV and sleep → medium confidence with specific reason', () => {
  const r = calculateReadiness({
    hrv_delta_pct: null, sleep_hours: null, sleep_quality: null,
    fatigue: 4, doms: 3, stress: 3, tqr: 12, md_plus: 2,
  })
  assert.equal(r.nAvailable, 5)  // fatigue + doms + stress + tqr + md
  assert.equal(r.confidence, 'medium')
  assert.match(r.confidenceReason, /HRV/)
  assert.match(r.confidenceReason, /Sono/)
})

test('full data with HRV and sleep → high confidence', () => {
  const r = calculateReadiness(FULL_INPUTS)
  assert.equal(r.confidence, 'high')
})

// ── calculateReadiness: weights ──────────────────────────────────────────────

test('READINESS_WEIGHTS_V1 sums to 1.0', () => {
  const total = Object.values(READINESS_WEIGHTS_V1).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1.0) < 0.0001, `weights sum to ${total}`)
})

test('custom weights are respected', () => {
  const heavyHrv = { ...READINESS_WEIGHTS_V1, hrv: 0.90, sleep: 0.10 / 6, fatigue: 0.10 / 6, doms: 0.10 / 6, stress: 0.10 / 6, tqr: 0.10 / 6, md: 0.10 / 6 }
  const r = calculateReadiness({ ...FULL_INPUTS, hrv_delta_pct: -0.30 }, heavyHrv)
  const rDefault = calculateReadiness({ ...FULL_INPUTS, hrv_delta_pct: -0.30 })
  // Heavy HRV weight should produce a higher score when HRV is impaired
  assert.ok(r.score > rDefault.score, `heavy-HRV score ${r.score} should exceed default ${rDefault.score}`)
})

// ── calculateReadiness: dominant variable ────────────────────────────────────

test('dominant variable is the highest contributor', () => {
  const r = calculateReadiness({
    hrv_delta_pct: -0.40,  // very impaired
    sleep_hours:   8,
    sleep_quality: 5,
    fatigue:       2,
    doms:          2,
    stress:        2,
    tqr:           18,
    md_plus:       5,
  })
  assert.equal(r.dominantVariable, 'hrv')
})

// ── calculateReadiness: missing list ────────────────────────────────────────

test('missing array lists variables with null input', () => {
  const r = calculateReadiness({
    hrv_delta_pct: null,
    sleep_hours:   7,
    sleep_quality: 3,
    fatigue:       3,
    doms:          null,
    stress:        null,
    tqr:           12,
    md_plus:       null,
  })
  assert.ok(r.missing.includes('hrv'),    'hrv should be missing')
  assert.ok(r.missing.includes('doms'),   'doms should be missing')
  assert.ok(r.missing.includes('stress'), 'stress should be missing')
  assert.ok(r.missing.includes('md'),     'md should be missing')
  assert.ok(!r.missing.includes('sleep'), 'sleep should not be missing')
})
