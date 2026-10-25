// Pushes dist/*.html and dist/subjects.json to the hosted project's Auth email templates
// through the Supabase Management API (alternative to pasting each one in the dashboard).
//
//   node supabase/templates/build.mjs
//   SUPABASE_ACCESS_TOKEN=sbp_... node supabase/templates/push.mjs          # dry run
//   SUPABASE_ACCESS_TOKEN=sbp_... node supabase/templates/push.mjs --apply  # PATCH
//
// Project ref: SUPABASE_PROJECT_REF, or derived from NEXT_PUBLIC_SUPABASE_URL.
// Field names follow the Management API auth config; check them against
// https://supabase.com/docs/reference/api/v1-update-auth-service-config before the first --apply.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist')

// dist file name -> Management API field suffix
const FIELDS = {
  'confirm-signup': 'confirmation',
  invite: 'invite',
  'magic-link': 'magic_link',
  'change-email': 'email_change',
  'reset-password': 'recovery',
  reauthentication: 'reauthentication',
}

const subjects = JSON.parse(readFileSync(join(dist, 'subjects.json'), 'utf8'))
const body = {}
for (const [file, suffix] of Object.entries(FIELDS)) {
  body[`mailer_subjects_${suffix}`] = subjects[file]
  body[`mailer_templates_${suffix}_content`] = readFileSync(join(dist, `${file}.html`), 'utf8')
}

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]

if (!ref) throw new Error('Set SUPABASE_PROJECT_REF (or NEXT_PUBLIC_SUPABASE_URL)')

if (!process.argv.includes('--apply')) {
  console.log(`Dry run for project ${ref}. Would PATCH these fields:`)
  for (const key of Object.keys(body)) console.log(`  ${key}`)
  console.log('Re-run with --apply (and SUPABASE_ACCESS_TOKEN) to push.')
  process.exit(0)
}

if (!token) throw new Error('Set SUPABASE_ACCESS_TOKEN (a Supabase personal access token)')

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
if (!res.ok) throw new Error(`PATCH failed: ${res.status} ${await res.text()}`)
console.log(`Updated ${Object.keys(body).length} fields on project ${ref}.`)
