// Zero-dependency static site generator for the Sophi landing page.
// Renders template.html against each locale's content/<locale>.json, plus the
// English-only security page.
// Run with: node build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SITE = {
  calendlyUrl: 'https://calendly.com/sophisports/demo',
  email: 'info@sophisports.com',
  address: 'Lisbon, Portugal',
  // Brevo hosted form. The markup Brevo serves uses a relative action, so it has to be
  // absolutised here. Posting to it directly (rather than embedding Brevo's iframe) keeps
  // the page free of third-party requests until someone actually submits.
  newsletterAction:
    'https://906fa3d3.sibforms.com/serve/MUIFAC7VNaYXm39OWpkVD0dUZa80ymTBvtXCslCcvZCOxBmxDRdiyJuHYRe5Q2sXkYirEX6cBrXac1fCcI0zs1V5WC8BSD8KB65dmZAq0gNfr9CW4P1RAim1IygISlSb--2UQsHVL-HD0A3fSXSS7Oc2ZAYMWoeoFSmZrVEnqXqFVdOTNtG6rgLoYr6g5nuhmjlol1rQTwtPmFdbAg==',
}

// Locale-invariant facts about the team. Roles, credentials and bios are translated and
// live in content/<locale>.json under team.people, positionally matched to this list —
// keeping names, photo filenames and LinkedIn URLs here stops them drifting between
// languages.
const TEAM = [
  {
    name: 'Diogo Simões',
    initials: 'DS',
    photo: 'diogo-simoes.jpg',
    linkedin: 'https://www.linkedin.com/in/diogodacruzsimoes/',
  },
  {
    name: 'Alexandre Cardoso',
    initials: 'AC',
    photo: 'alexandre-cardoso.jpg',
    linkedin: 'https://www.linkedin.com/in/alexandre-cardoso-260b8857/',
  },
  {
    name: 'Tiago Pimentel',
    initials: 'TP',
    photo: 'tiago-pimentel.jpg',
    linkedin: 'https://www.linkedin.com/in/tiagopimentel94/',
  },
]

// en is the default locale, served at the site root; pt/es live in their own folder.
const LOCALES = [
  { code: 'en', dir: '', file: 'en.json' },
  { code: 'pt', dir: 'pt', file: 'pt.json' },
  { code: 'es', dir: 'es', file: 'es.json' },
]

// Raw fragments injected with {{&name}} (not HTML-escaped).
const PARTIALS = {
  lockup: readFileSync(join(__dirname, 'partials', 'lockup.svg'), 'utf8').trim(),
  // Not "linkedin" — each team member carries a `linkedin` URL that would shadow it.
  linkedinIcon: readFileSync(join(__dirname, 'partials', 'linkedin.svg'), 'utf8').trim(),
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function render(tpl, data) {
  // {{#each some.path}} ... {{/each}} — nestable; find the matching close by depth.
  const open = /{{#each ([\w.]+)}}/
  let m
  while ((m = open.exec(tpl)) !== null) {
    const blockStart = m.index
    const innerStart = blockStart + m[0].length
    const scan = /{{#each [\w.]+}}|{{\/each}}/g
    scan.lastIndex = innerStart
    let depth = 1
    let innerEnd = -1
    let blockEnd = -1
    let tok
    while ((tok = scan.exec(tpl)) !== null) {
      if (tok[0].startsWith('{{#each')) {
        depth++
      } else if (--depth === 0) {
        innerEnd = tok.index
        blockEnd = tok.index + tok[0].length
        break
      }
    }
    if (innerEnd === -1) throw new Error(`Unclosed {{#each ${m[1]}}}`)

    const inner = tpl.slice(innerStart, innerEnd)
    const arr = getPath(data, m[1]) || []
    const out = arr.map((item) => render(inner, { ...data, ...item })).join('')
    tpl = tpl.slice(0, blockStart) + out + tpl.slice(blockEnd)
  }
  // {{&name}} — raw fragment, no escaping.
  tpl = tpl.replace(/{{&([\w.]+)}}/g, (_, path) => {
    const val = getPath(data, path)
    return val !== undefined ? val : ''
  })
  // {{some.path}} — plain substitution, HTML-escaped.
  tpl = tpl.replace(/{{([\w.]+)}}/g, (_, path) => {
    const val = getPath(data, path)
    return val !== undefined ? escapeHtml(val) : ''
  })
  return tpl
}

function hrefFor(locale) {
  return locale.dir ? `/${locale.dir}/` : '/'
}

function write(relPath, html) {
  const outFile = join(__dirname, relPath)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, html)
  console.log('wrote', relPath)
}

function localeData(locale) {
  const content = JSON.parse(readFileSync(join(__dirname, 'content', locale.file), 'utf8'))
  const langs = LOCALES.map((l) => ({
    code: l.code.toUpperCase(),
    href: hrefFor(l),
    current: l.code === locale.code ? 'true' : 'false',
  }))
  return {
    ...content,
    ...SITE,
    ...PARTIALS,
    homeHref: hrefFor(locale),
    privacyHref: `${hrefFor(locale)}privacy/`,
    localeCode: locale.code,
    langs,
    team: {
      ...content.team,
      people: TEAM.map((person, i) => ({ ...person, ...(content.team?.people?.[i] ?? {}) })),
    },
    footer: {
      ...content.footer,
      emailSubjectEncoded: encodeURIComponent(content.footer.emailSubject),
    },
  }
}

/* ---------------- locale landing pages + privacy notice ---------------- */
const template = readFileSync(join(__dirname, 'template.html'), 'utf8')
const privacyTpl = readFileSync(join(__dirname, 'template-privacy.html'), 'utf8')

for (const locale of LOCALES) {
  const data = localeData(locale)
  write(join(locale.dir, 'index.html'), render(template, data))

  // The newsletter form collects an address in every locale, so the notice that governs
  // it has to be readable in every locale too.
  const privacy = JSON.parse(
    readFileSync(join(__dirname, 'content', `privacy.${locale.code}.json`), 'utf8'),
  )
  privacy.contact.subjectEncoded = encodeURIComponent(privacy.contact.subject)
  write(join(locale.dir, 'privacy', 'index.html'), render(privacyTpl, { ...data, privacy }))
}

/* ---------------- security page (English only for now) ---------------- */
const securityTpl = readFileSync(join(__dirname, 'template-security.html'), 'utf8')
const securityContent = JSON.parse(readFileSync(join(__dirname, 'content', 'security.en.json'), 'utf8'))
const enData = localeData(LOCALES[0])

write('security/index.html', render(securityTpl, { ...enData, security: securityContent }))
