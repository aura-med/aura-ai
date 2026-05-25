import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('main app moves medical panel into the clinical section as Clinical Portal', () => {
  const sidebar = readFileSync('components/layout/Sidebar.tsx', 'utf8')
  const enMessages = readFileSync('messages/en.json', 'utf8')

  assert.match(sidebar, /href:\s*'\/clinical-portal'/)
  assert.match(sidebar, /labelKey:\s*'clinical_portal'/)
  assert.match(sidebar, /sectionKey:\s*'clinical'/)
  assert.match(enMessages, /"clinical_portal":\s*"Clinical Portal"/)
  assert.doesNotMatch(sidebar, /labelKey:\s*'admin_injuries'/)
  assert.doesNotMatch(sidebar, /labelKey:\s*'admin_protocols'/)
})

test('admin app owns injury management and rehab protocol navigation', () => {
  const sidebar = readFileSync('apps/admin/components/sidebar.tsx', 'utf8')

  assert.match(sidebar, /href:\s*'\/injuries'/)
  assert.match(sidebar, /label:\s*'Injury Management'/)
  assert.match(sidebar, /href:\s*'\/protocols'/)
  assert.match(sidebar, /label:\s*'Rehab Protocols'/)
  assert.ok(existsSync('apps/admin/app/(admin)/injuries/page.tsx'))
  assert.ok(existsSync('apps/admin/app/(admin)/protocols/page.tsx'))
})
