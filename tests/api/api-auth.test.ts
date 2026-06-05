import assert from 'node:assert/strict'
import test from 'node:test'
import {
  API_TOKEN_TTL_SECONDS,
  signApiToken,
  verifyApiToken,
  verifyApiViewerFromRequest,
} from '../../lib/api/auth.ts'

const SECRET = 'test-secret-at-least-32-characters'

test('API token verifies with viewer claims and 30 minute expiry', async () => {
  const token = await signApiToken({
    userId: 'user-1',
    email: 'user@example.com',
    orgId: 'org-1',
    role: 'physio',
  }, { secret: SECRET, now: 1_700_000_000 })

  const viewer = await verifyApiToken(token, { secret: SECRET, now: 1_700_000_100 })

  assert.equal(API_TOKEN_TTL_SECONDS, 1800)
  assert.equal(viewer.userId, 'user-1')
  assert.equal(viewer.email, 'user@example.com')
  assert.equal(viewer.orgId, 'org-1')
  assert.equal(viewer.role, 'physio')
})

test('expired API token is rejected', async () => {
  const token = await signApiToken({
    userId: 'user-1',
    email: 'user@example.com',
    orgId: 'org-1',
    role: 'physio',
  }, { secret: SECRET, now: 1_700_000_000 })

  await assert.rejects(
    () => verifyApiToken(token, { secret: SECRET, now: 1_700_001_801 }),
    /expired/i,
  )
})

test('malformed API token is rejected', async () => {
  await assert.rejects(
    () => verifyApiToken('not-a-token', { secret: SECRET, now: 1_700_000_000 }),
    /invalid/i,
  )
})

test('request without bearer token is unauthenticated', async () => {
  const request = new Request('http://localhost/api/users')

  await assert.rejects(
    () => verifyApiViewerFromRequest(request, { secret: SECRET, now: 1_700_000_000 }),
    /unauthorized/i,
  )
})

