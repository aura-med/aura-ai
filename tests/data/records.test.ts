import test from 'node:test'
import assert from 'node:assert/strict'
import { asRecordArray, latestByDate, sortByDateDesc } from '../../lib/data/records.ts'
import { rehabSessionRootFromSession } from '../../lib/data/rehab-shape.ts'
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

test('rehab session rows are shaped from active protocol sessions', () => {
  const root = rehabSessionRootFromSession({
    id: 'session-1',
    start_date: '2026-07-01',
    current_day: 6,
    rtp_criteria: [{ label: 'Pain free running', done: true }],
    clinical_data: { pain_vas: 1 },
    athletes: {
      id: 'athlete-1',
      name: 'Miguel Santos',
      position: 'FW',
      club: 'FPF',
      status: 'available',
      injury_events: [
        {
          injury_date: '2026-06-30',
          return_date: null,
          diagnosis: 'Hamstring grade II',
          severity: 'moderate',
          location: 'Right hamstring',
        },
      ],
    },
    rehab_protocols: {
      key: 'hamstring',
      name: 'Isquiotibial Grau II',
      total_days: 28,
      evidence: 'Clinical RTP protocol',
      phases: [{ id: 1, name: 'Acute', d1: 1, d2: 7, range: 'D1-D7', color: 'var(--warn)', ex: ['Bike'], criteria: 'Pain <= 2' }],
    },
  })

  assert.equal(root.id, 'athlete-1')
  assert.equal(root.name, 'Miguel Santos')
  assert.deepEqual(root.injury_events, [
    {
      injury_date: '2026-06-30',
      return_date: null,
      diagnosis: 'Hamstring grade II',
      severity: 'moderate',
      location: 'Right hamstring',
    },
  ])
  assert.equal(asRecordArray(root.rehab_sessions)[0]?.id, 'session-1')
})
