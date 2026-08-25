import assert from 'node:assert/strict'
import test from 'node:test'
import { signApiToken } from '../../lib/api/auth.ts'
import {
  handleCreateUser,
  handleGetUser,
  handleListUsers,
  type ApiUsersService,
} from '../../lib/api/users.ts'
import type { UserRole } from '../../types/index.ts'

const SECRET = 'test-secret-at-least-32-characters'

async function authHeaders(role: UserRole = 'owner') {
  const token = await signApiToken({
    userId: 'actor-1',
    email: 'actor@example.com',
    orgId: 'org-1',
    role,
  }, { secret: SECRET, now: 1_700_000_000 })

  return { Authorization: `Bearer ${token}` }
}

function usersService(overrides: Partial<ApiUsersService> = {}): ApiUsersService {
  return {
    listUsers: async () => ({
      items: [{ id: 'user-1', email: 'user@example.com', full_name: 'User One', role: 'physio' }],
      page: 1,
      pageSize: 20,
      total: 1,
    }),
    getUserById: async () => ({ id: 'user-1', email: 'user@example.com', full_name: 'User One', role: 'physio' }),
    findUserByEmail: async () => null,
    createUser: async () => ({ id: 'user-2', email: 'new@example.com', full_name: 'New User', role: 'physio' }),
    ...overrides,
  }
}

test('unauthenticated GET returns 401', async () => {
  const response = await handleListUsers(
    new Request('http://localhost/api/users'),
    { jwtSecret: SECRET, now: 1_700_000_000, service: usersService() },
  )

  assert.equal(response.status, 401)
})

test('authenticated GET returns 200', async () => {
  const response = await handleListUsers(
    new Request('http://localhost/api/users?page=1&pageSize=20', { headers: await authHeaders() }),
    { jwtSecret: SECRET, now: 1_700_000_000, service: usersService() },
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.items.length, 1)
  assert.equal(body.page, 1)
})

test('authenticated GET by ID returns 200', async () => {
  const response = await handleGetUser(
    new Request('http://localhost/api/users/user-1', { headers: await authHeaders() }),
    'user-1',
    { jwtSecret: SECRET, now: 1_700_000_000, service: usersService() },
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.id, 'user-1')
})

test('POST with valid body returns 201', async () => {
  const response = await handleCreateUser(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', role: 'physio', full_name: 'New User' }),
    }),
    { jwtSecret: SECRET, now: 1_700_000_000, service: usersService() },
  )

  assert.equal(response.status, 201)
  const body = await response.json()
  assert.equal(body.email, 'new@example.com')
})

test('POST with invalid body returns 400', async () => {
  const response = await handleCreateUser(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', role: 'physio' }),
    }),
    { jwtSecret: SECRET, now: 1_700_000_000, service: usersService() },
  )

  assert.equal(response.status, 400)
})

test('POST from a non-owner role returns 403', async () => {
  const response = await handleCreateUser(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { ...(await authHeaders('physio')), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', role: 'physio', full_name: 'New User' }),
    }),
    { jwtSecret: SECRET, now: 1_700_000_000, service: usersService() },
  )

  assert.equal(response.status, 403)
})

test('POST with duplicate email returns 409', async () => {
  const response = await handleCreateUser(
    new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'taken@example.com', role: 'physio' }),
    }),
    {
      jwtSecret: SECRET,
      now: 1_700_000_000,
      service: usersService({
        findUserByEmail: async () => ({ id: 'existing-user', email: 'taken@example.com', full_name: null, role: 'physio' }),
      }),
    },
  )

  assert.equal(response.status, 409)
})

