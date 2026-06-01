import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { postgresUuidSchema } from '../../lib/schemas/ids.ts'

test('accepts Postgres UUID-shaped fixture ids', () => {
  assert.equal(postgresUuidSchema.safeParse('a1000001-0000-0000-0000-000000000001').success, true)
  assert.equal(postgresUuidSchema.safeParse('b1000001-0000-0000-0000-000000000002').success, true)
  assert.equal(postgresUuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success, true)
})

test('rejects empty strings and malformed ids', () => {
  assert.equal(postgresUuidSchema.safeParse('').success, false)
  assert.equal(postgresUuidSchema.safeParse('not-a-uuid').success, false)
  assert.equal(postgresUuidSchema.safeParse('a1000001-0000-0000-0000').success, false)
})

test('database id schemas use Postgres UUID validation instead of strict RFC uuid validation', () => {
  const schemaFiles = [
    'lib/schemas/passport.ts',
    'lib/schemas/preferences.ts',
    'lib/schemas/rehab.ts',
    'lib/schemas/score.ts',
    'lib/schemas/squad.ts',
    'lib/schemas/wellness.ts',
  ]

  for (const path of schemaFiles) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /postgresUuidSchema/)
    assert.doesNotMatch(source, /\.uuid\(\)/)
  }
})
