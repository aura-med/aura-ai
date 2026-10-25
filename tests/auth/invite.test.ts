import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInviteOptions,
  destinationFor,
  isConfirmableOtpType,
  safeNextPath,
} from '../../lib/auth/invite.ts'

test('buildInviteOptions flags the invitee as needing a password and sets redirectTo', () => {
  assert.deepEqual(buildInviteOptions('Ana Silva', 'https://app.sophisports.com/'), {
    data: { full_name: 'Ana Silva', needs_password: true },
    redirectTo: 'https://app.sophisports.com/auth/confirm',
  })
})

test('buildInviteOptions omits full_name and redirectTo when unavailable', () => {
  assert.deepEqual(buildInviteOptions(null, undefined), { data: { needs_password: true } })
  assert.deepEqual(buildInviteOptions('', '  '), { data: { needs_password: true } })
})

test('safeNextPath only allows same-origin absolute paths', () => {
  assert.equal(safeNextPath(null), '/')
  assert.equal(safeNextPath('/athletes'), '/athletes')
  assert.equal(safeNextPath('https://evil.example', '/reset-password'), '/reset-password')
  assert.equal(safeNextPath('//evil.example'), '/')
  assert.equal(safeNextPath('/\\evil.example'), '/')
})

test('only the four email-link types can be confirmed', () => {
  for (const type of ['invite', 'recovery', 'email', 'email_change']) {
    assert.equal(isConfirmableOtpType(type), true, type)
  }
  assert.equal(isConfirmableOtpType('magiclink'), false)
  assert.equal(isConfirmableOtpType('signup'), false)
  assert.equal(isConfirmableOtpType(null), false)
})

test('invite and recovery land on reset-password; sign-up, magic link and email change on the dashboard', () => {
  assert.equal(destinationFor('invite'), '/reset-password')
  assert.equal(destinationFor('recovery'), '/reset-password')
  assert.equal(destinationFor('email'), '/')
  assert.equal(destinationFor('email_change'), '/')
})
