import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normHrvDelta,
  normSleep,
  normSleepHoursOnly,
  normHooper,
  normTqr,
  normMd,
  normalizeReadinessInputs,
} from '../../lib/readiness/normalization.ts'

// ── normHrvDelta ─────────────────────────────────────────────────────────────

test('normHrvDelta: Δ within ±5% is 0 (normal variation)', () => {
  assert.equal(normHrvDelta(0.04),  0)
  assert.equal(normHrvDelta(-0.04), 0)
  assert.equal(normHrvDelta(0),     0)
})

test('normHrvDelta: Δ ≥ 30% is 1.0 (fully impaired)', () => {
  assert.equal(normHrvDelta(0.30),  1)
  assert.equal(normHrvDelta(-0.30), 1)
  assert.equal(normHrvDelta(0.50),  1)
})

test('normHrvDelta: Δ 10% below baseline returns expected partial', () => {
  const result = normHrvDelta(-0.10)
  assert.ok(result > 0 && result < 1, `expected (0,1) got ${result}`)
  assert.equal(result, normHrvDelta(0.10))  // symmetrical (absolute value)
})

// ── normSleep ────────────────────────────────────────────────────────────────

test('normSleep: 8h + quality 4 yields 0 (optimal)', () => {
  assert.equal(normSleep(8, 4), 0)
})

test('normSleep: 5.5h + quality 1 yields 1.0 (worst case)', () => {
  assert.equal(normSleep(5.5, 1), 1)
})

test('normSleep: 6h + quality 2 is impaired but not maximal', () => {
  const s = normSleep(6, 2)
  assert.ok(s > 0 && s < 1, `expected (0,1) got ${s}`)
})

test('normSleepHoursOnly: 7h or more → 0', () => {
  assert.equal(normSleepHoursOnly(7),  0)
  assert.equal(normSleepHoursOnly(9),  0)
})

test('normSleepHoursOnly: ≤ 5.5h → 1.0', () => {
  assert.equal(normSleepHoursOnly(5.5), 1)
  assert.equal(normSleepHoursOnly(4),   1)
})

// ── normHooper ───────────────────────────────────────────────────────────────

test('normHooper: Hooper ≤ 2 → 0 (no impairment)', () => {
  assert.equal(normHooper(1), 0)
  assert.equal(normHooper(2), 0)
})

test('normHooper: Hooper ≥ 7 → 1.0 (maximum)', () => {
  assert.equal(normHooper(7),  1)
  assert.equal(normHooper(10), 1)
})

test('normHooper: Hooper 4 → 0.4', () => {
  const v = normHooper(4)
  assert.ok(Math.abs(v - 0.4) < 0.001, `expected 0.4 got ${v}`)
})

// ── normTqr ──────────────────────────────────────────────────────────────────

test('normTqr: TQR ≥ 14 → 0 (fully recovered)', () => {
  assert.equal(normTqr(14), 0)
  assert.equal(normTqr(20), 0)
})

test('normTqr: TQR ≤ 6 → 1.0 (not recovered)', () => {
  assert.equal(normTqr(6), 1)
  assert.equal(normTqr(4), 1)
})

test('normTqr: TQR 10 → 0.5', () => {
  const v = normTqr(10)
  assert.ok(Math.abs(v - 0.5) < 0.001, `expected 0.5 got ${v}`)
})

// ── normMd ───────────────────────────────────────────────────────────────────

test('normMd: MD+0 (match day) → 1.0', () => {
  assert.equal(normMd(0), 1.0)
})

test('normMd: MD+1 → 0.85', () => {
  assert.equal(normMd(1), 0.85)
})

test('normMd: MD+5 or beyond → 0 (normalized)', () => {
  assert.equal(normMd(5), 0)
  assert.equal(normMd(7), 0)
  assert.equal(normMd(99), 0)
})

test('normMd: rounds fractional days', () => {
  assert.equal(normMd(1.4), normMd(1))
  assert.equal(normMd(1.6), normMd(2))
})

// ── normalizeReadinessInputs ─────────────────────────────────────────────────

test('normalizeReadinessInputs: null inputs produce null partials', () => {
  const p = normalizeReadinessInputs({
    hrv_delta_pct: null, sleep_hours: null, sleep_quality: null,
    fatigue: null, doms: null, stress: null, tqr: null, md_plus: null,
  })
  assert.equal(p.hrv,     null)
  assert.equal(p.sleep,   null)
  assert.equal(p.fatigue, null)
  assert.equal(p.doms,    null)
  assert.equal(p.stress,  null)
  assert.equal(p.tqr,     null)
  assert.equal(p.md,      null)
})

test('normalizeReadinessInputs: falls back to hours-only when quality is null', () => {
  const withQuality    = normalizeReadinessInputs({ hrv_delta_pct: null, sleep_hours: 6, sleep_quality: 3,    fatigue: null, doms: null, stress: null, tqr: null, md_plus: null })
  const withoutQuality = normalizeReadinessInputs({ hrv_delta_pct: null, sleep_hours: 6, sleep_quality: null, fatigue: null, doms: null, stress: null, tqr: null, md_plus: null })
  // Both should be non-null; hours-only path gives a different value
  assert.ok(withQuality.sleep    !== null)
  assert.ok(withoutQuality.sleep !== null)
  assert.notEqual(withQuality.sleep, withoutQuality.sleep)
})

test('normalizeReadinessInputs: full input set produces all non-null partials', () => {
  const p = normalizeReadinessInputs({
    hrv_delta_pct: -0.10, sleep_hours: 7, sleep_quality: 4,
    fatigue: 3, doms: 2, stress: 4, tqr: 14, md_plus: 3,
  })
  for (const [k, v] of Object.entries(p)) {
    assert.ok(v !== null, `partial.${k} should not be null`)
    assert.ok((v as number) >= 0 && (v as number) <= 1, `partial.${k}=${v} out of [0,1]`)
  }
})
