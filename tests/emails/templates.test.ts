import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

execFileSync('node', ['supabase/templates/build.mjs'], { stdio: 'ignore' })

const read = (name: string) => readFileSync(`supabase/templates/dist/${name}.html`, 'utf8')
const subjects = JSON.parse(readFileSync('supabase/templates/dist/subjects.json', 'utf8')) as Record<string, string>

const linked = {
  'confirm-signup': 'email',
  invite: 'invite',
  'magic-link': 'email',
  'change-email': 'email_change',
  'reset-password': 'recovery',
} as const

for (const [name, type] of Object.entries(linked)) {
  test(`${name} links to /auth/confirm with token_hash and type=${type}`, () => {
    const html = read(name)
    assert.ok(
      html.includes(`href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}"`),
      `${name}: confirm link`,
    )
    assert.ok(!html.includes('{{ .ConfirmationURL }}'), `${name}: must not use ConfirmationURL`)
  })
}

test('reauthentication shows the OTP and has no link', () => {
  const html = read('reauthentication')
  assert.ok(html.includes('{{ .Token }}'))
  assert.ok(!html.includes('<a '))
  assert.ok(subjects.reauthentication.includes('{{ .Token }}'))
})

test('magic link offers both the link and the OTP', () => {
  assert.ok(read('magic-link').includes('{{ .Token }}'))
})

test('change email names the new address', () => {
  assert.ok(read('change-email').includes('{{ .NewEmail }}'))
})

test('every template uses the hosted logo, balanced template tags and a non-empty subject', () => {
  for (const name of ['confirm-signup', 'invite', 'magic-link', 'change-email', 'reset-password', 'reauthentication']) {
    const html = read(name)
    assert.ok(html.includes('{{ .SiteURL }}/email/sophi-logo.png'), `${name}: logo`)
    assert.equal((html.match(/\{\{/g) ?? []).length, (html.match(/\}\}/g) ?? []).length, `${name}: balanced`)
    assert.ok(subjects[name]?.trim(), `${name}: subject`)
  }
})
