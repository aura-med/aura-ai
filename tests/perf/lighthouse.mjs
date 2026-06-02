#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const label = sanitizeLabel(process.env.PERF_LABEL ?? 'local')
const mainBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'
const adminBaseURL = process.env.AURA_ADMIN_BASE_URL ??
  (process.env.PERF_START_ADMIN_SERVER === '1' ? 'http://127.0.0.1:3001' : undefined)
const outputDir = `.perf/lighthouse/${label}`
const lighthouseBin = resolveLighthouseBinary()

const mainRoutes = [
  ['dashboard', '/'],
  ['readiness', '/readiness'],
  ['passport', '/passport'],
  ['calendar', '/calendar'],
  ['load', '/load'],
  ['rehab', '/rehab'],
  ['clinical-portal', '/clinical-portal'],
  ['input-scoring', '/input?squadId=9b8cd13c-11cc-4e97-8e13-9c88d814afb8'],
  ['athletes', '/athletes'],
]

const athletePath = process.env.PERF_ATHLETE_PATH ??
  (process.env.PERF_ATHLETE_ID ? `/athletes/${process.env.PERF_ATHLETE_ID}` : null)

if (athletePath) {
  for (const tab of ['overview', 'medical', 'injuries', 'treatments', 'documents', 'recommendations']) {
    const url = new URL(athletePath, mainBaseURL)
    url.searchParams.set('tab', tab)
    mainRoutes.push([`athlete-profile-${tab}`, `${url.pathname}${url.search}`])
  }
}

const adminRoutes = adminBaseURL
  ? [
      ['admin-dashboard', '/'],
      ['admin-users', '/users'],
      ['admin-security', '/security'],
      ['admin-analytics', '/analytics'],
      ['admin-organizations', '/organizations'],
      ['admin-injuries', '/injuries'],
      ['admin-protocols', '/protocols'],
      ['admin-operations', '/operations'],
      ['admin-settings', '/settings'],
    ]
  : []

await mkdir(outputDir, { recursive: true })

for (const [name, path] of mainRoutes) {
  await runLighthouse({
    name,
    url: new URL(path, mainBaseURL).toString(),
    storageStatePath: 'tests/.auth/perf-main.json',
  })
}

for (const [name, path] of adminRoutes) {
  await runLighthouse({
    name,
    url: new URL(path, adminBaseURL).toString(),
    storageStatePath: 'tests/.auth/perf-admin.json',
  })
}

async function runLighthouse({ name, url, storageStatePath }) {
  for (const profile of ['mobile', 'desktop']) {
    const outputPath = join(outputDir, `${name}-${profile}.json`)
    await mkdir(dirname(outputPath), { recursive: true })

    const args = [
      url,
      '--quiet',
      '--output=json',
      `--output-path=${outputPath}`,
      '--only-categories=performance',
      '--chrome-flags=--headless=new',
    ]

    if (profile === 'desktop') {
      args.push('--preset=desktop')
    }

    const extraHeaders = await extraHeadersFromStorageState(storageStatePath, url)
    await assertAuthenticatedPage(url, extraHeaders)
    args.push(`--extra-headers=${JSON.stringify(extraHeaders)}`)

    await exec(lighthouseBin, args)
  }
}

function resolveLighthouseBinary() {
  if (process.env.LIGHTHOUSE_BIN) return process.env.LIGHTHOUSE_BIN
  const localBinary = 'node_modules/.bin/lighthouse'
  if (existsSync(localBinary)) return localBinary
  throw new Error('Lighthouse binary not found. Install a pinned lighthouse dev dependency or set LIGHTHOUSE_BIN=/path/to/lighthouse.')
}

async function extraHeadersFromStorageState(path, url) {
  const state = JSON.parse(await readFile(path, 'utf8'))
  const hostname = new URL(url).hostname
  const cookies = (state.cookies ?? [])
    .filter((cookie) => cookieMatchesHost(cookie.domain, hostname))
    .map((cookie) => `${cookie.name}=${cookie.value}`)

  if (cookies.length === 0) {
    throw new Error(`No auth cookies in ${path} match ${hostname}. Run the perf Playwright auth setup first.`)
  }

  return { Cookie: cookies.join('; ') }
}

async function assertAuthenticatedPage(url, headers) {
  const response = await fetch(url, { headers, redirect: 'follow' })
  const finalPath = new URL(response.url).pathname
  const body = await response.text()

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Lighthouse preflight failed for ${url}: HTTP ${response.status}`)
  }
  if (/^\/(login|auth|signin)\b/i.test(finalPath)) {
    throw new Error(`Lighthouse preflight for ${url} redirected to ${response.url}`)
  }
  if (/Acesso restrito|Entrar|Login|Sign in/i.test(body)) {
    throw new Error(`Lighthouse preflight for ${url} looks unauthenticated or restricted`)
  }
}

function cookieMatchesHost(rawDomain, hostname) {
  const domain = String(rawDomain ?? '').replace(/^\./, '')
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

function exec(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

function sanitizeLabel(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'local'
}
