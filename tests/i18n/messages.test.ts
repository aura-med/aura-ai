import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const locales = ['en', 'pt', 'es'] as const

const requiredAuthPaths = [
  'brandSubtitle',
  'emailLabel',
  'login.passwordLabel',
  'login.forgotPassword',
  'login.submit',
  'login.submitting',
  'login.restrictedAccess',
  'controls.toggleTheme',
] as const

test('root message bundles include auth copy for login and auth controls', () => {
  for (const locale of locales) {
    const messages = JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')) as Record<string, unknown>

    for (const path of requiredAuthPaths) {
      assert.equal(typeof readPath(messages, `auth.${path}`), 'string', `${locale}: auth.${path}`)
    }
  }
})

function readPath(source: unknown, path: string) {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, source)
}
