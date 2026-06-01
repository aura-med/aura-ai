import test from 'node:test'
import assert from 'node:assert/strict'
import { asRecordArray, latestByDate, sortByDateDesc } from '../../lib/data/records.ts'
import { clinicalStatus, riskStatus } from '../../lib/data/status.ts'

test('record helpers normalize unknown Supabase shapes', () => {
  assert.deepEqual(asRecordArray(null), [])
  assert.deepEqual(asRecordArray([{ id: 'a' }, null]).map((row) => row.id ?? null), ['a', null])
})

test('latestByDate returns the newest dated record', () => {
  const latest = latestByDate([
    { id: 'old', checkin_date: '2026-01-01' },
    { id: 'new', checkin_date: '2026-05-09' },
  ], 'checkin_date')

  assert.equal(latest.id, 'new')
})

test('sortByDateDesc keeps invalid dates last', () => {
  const rows = sortByDateDesc([
    { id: 'bad', date: null },
    { id: 'ok', date: '2026-05-09' },
  ], 'date')

  assert.equal(rows[0].id, 'ok')
})

test('clinical status DTOs include non-color labels and aria text', () => {
  const red = clinicalStatus('red', 'Prontidao global')
  assert.equal(red.label, 'Limitado')
  assert.equal(red.priority, 'urgent')
  assert.match(red.ariaLabel, /Prontidao global/)

  assert.equal(riskStatus(88).label, 'Risco crítico')
})
