import assert from 'node:assert/strict'
import test from 'node:test'
import { postgresUuidSchema } from '../../lib/schemas/ids.ts'
import { authorizeScoreAccess, normalizeOrgId } from '../../lib/scoring/score-access.ts'

const ORG_A = '11111111-1111-1111-1111-111111111111'
const ORG_B = '22222222-2222-2222-2222-222222222222'

test('fixture athlete id remains valid for score route validation', () => {
  assert.equal(postgresUuidSchema.safeParse('a1000001-0000-0000-0000-000000000001').success, true)
})

test('score route rejects unauthenticated requests', () => {
  const result = authorizeScoreAccess({
    userId: null,
    profileOrgId: ORG_A,
    athleteOrgId: ORG_A,
    athleteFound: true,
  })

  assert.deepEqual(result, { ok: false, status: 401, orgId: null, error: 'Unauthorized' })
})

test('score route rejects users without an org', () => {
  const result = authorizeScoreAccess({
    userId: 'user-1',
    profileOrgId: '',
    athleteOrgId: ORG_A,
    athleteFound: true,
  })

  assert.deepEqual(result, { ok: false, status: 403, orgId: null, error: 'Forbidden' })
})

test('score route returns not found before cross-org checks when athlete is missing', () => {
  const result = authorizeScoreAccess({
    userId: 'user-1',
    profileOrgId: ORG_A,
    athleteOrgId: null,
    athleteFound: false,
  })

  assert.deepEqual(result, { ok: false, status: 404, orgId: null, error: 'Athlete not found' })
})

test('score route rejects cross-org athletes', () => {
  const result = authorizeScoreAccess({
    userId: 'user-1',
    profileOrgId: ORG_A,
    athleteOrgId: ORG_B,
    athleteFound: true,
  })

  assert.deepEqual(result, { ok: false, status: 403, orgId: null, error: 'Forbidden' })
})

test('score route rejects athletes with missing orgs instead of passing empty org_id to logging', () => {
  const result = authorizeScoreAccess({
    userId: 'user-1',
    profileOrgId: ORG_A,
    athleteOrgId: '',
    athleteFound: true,
  })

  assert.deepEqual(result, { ok: false, status: 403, orgId: null, error: 'Forbidden' })
  assert.equal(normalizeOrgId(''), null)
})

test('score route allows same-org athletes and returns the validated org id', () => {
  const result = authorizeScoreAccess({
    userId: 'user-1',
    profileOrgId: ORG_A,
    athleteOrgId: ORG_A,
    athleteFound: true,
  })

  assert.deepEqual(result, { ok: true, status: 200, orgId: ORG_A })
})
