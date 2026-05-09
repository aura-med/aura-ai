import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('rehab RTP controls use semantic checkbox inputs', () => {
  const source = readFileSync('app/(dashboard)/rehab/RehabClient.tsx', 'utf8')
  assert.match(source, /type="checkbox"/)
  assert.doesNotMatch(source, /className="rtp-check"/)
})

test('notification center exposes dialog and escape close behavior', () => {
  const source = readFileSync('components/layout/NotificationCenter.tsx', 'utf8')
  assert.match(source, /role="dialog"/)
  assert.match(source, /aria-expanded/)
  assert.match(source, /key === 'Escape'/)
})

test('readiness rows render text labels in addition to colors', () => {
  const source = readFileSync('app/(dashboard)/readiness/page.tsx', 'utf8')
  assert.match(source, /row\.readiness\.overall\.label/)
  assert.match(source, /indicator\.status\.label/)
})
