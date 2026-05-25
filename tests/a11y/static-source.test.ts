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

test('topbar select triggers expose accessible names', () => {
  const source = readFileSync('components/layout/TopbarClient.tsx', 'utf8')
  assert.match(source, /aria-label="Choose squad"/)
  assert.match(source, /aria-label="Choose language"/)
})

test('readiness rows render text labels in addition to colors', () => {
  const source = readFileSync('app/(dashboard)/readiness/page.tsx', 'utf8')
  assert.match(source, /row\.readiness\.overall\.label/)
  assert.match(source, /indicator\.status\.label/)
})

test('input page resets stale athlete selection when squad data changes', () => {
  const source = readFileSync('app/(dashboard)/input/InputClient.tsx', 'utf8')
  assert.match(source, /useEffect/)
  assert.match(source, /dto\.athletes\.some\(\(athlete\) => athlete\.id === selectedId\)/)
  assert.match(source, /disabled=\{isPending \|\| !selectedAthlete\}/)
})

test('rehab API routes normalize Supabase athlete relation shape', () => {
  const routePaths = [
    'app/api/rehab/[sessionId]/assessment/route.ts',
    'app/api/rehab/[sessionId]/progress/route.ts',
    'app/api/rehab/[sessionId]/rtp/route.ts',
  ]

  for (const path of routePaths) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /firstRecord\(session\.athletes\)/)
    assert.doesNotMatch(source, /session\.athletes as \{ org_id: string \}/)
  }
})
