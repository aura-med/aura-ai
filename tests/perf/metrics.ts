import type { Page, Request, Response, TestInfo } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type RouteBenchmark = {
  name: string
  path: string
  url: string
  status: number | null
  ttfbMs: number | null
  domContentLoadedMs: number | null
  loadMs: number | null
  appStableMs: number | null
  jsBytes: number
  jsRequests: number
  nextStaticBytes: number
  nextStaticRequests: number
  routeBytes: number
  routeRequests: number
  rscBytes: number
  rscRequests: number
  supabaseRequests: number
  supabaseDurationMs: number
  supabaseMaxDurationMs: number
  transferBytes: number
  resourceCount: number
  errors: string[]
}

export type PerfReport = {
  label: string
  generatedAt: string
  baseURL: string | null
  adminBaseURL: string | null
  routes: RouteBenchmark[]
}

type NetworkSample = {
  url: string
  method: string
  resourceType: string
  startTime: number
  responseStart: number
  responseEnd: number
  durationMs: number
}

type ResourceSample = {
  name: string
  initiatorType: string
  transferSize: number
  encodedBodySize: number
  decodedBodySize: number
}

export function perfLabel() {
  return sanitizeLabel(process.env.PERF_LABEL ?? 'local')
}

export function perfOutputPath() {
  return `.perf/${perfLabel()}.json`
}

export function hasMainAuthState() {
  return hasAuthInputs('E2E_USER_EMAIL', 'E2E_USER_PASSWORD') || existsSync('tests/.auth/perf-main.json')
}

export function hasAdminAuthState() {
  return (
    (hasAuthInputs('AURA_ADMIN_EMAIL', 'AURA_ADMIN_PASSWORD') ||
      hasAuthInputs('E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD')) ||
    existsSync('tests/.auth/perf-admin.json')
  )
}

export function adminBaseURL() {
  return envValue('AURA_ADMIN_BASE_URL') ??
    (envValue('PERF_START_ADMIN_SERVER') === '1' ? 'http://127.0.0.1:3001' : undefined)
}

export async function benchmarkRoute(
  page: Page,
  route: { name: string; path: string; url?: string },
  testInfo: TestInfo,
): Promise<RouteBenchmark> {
  const url = route.url ?? route.path
  const errors: string[] = []
  const samples: NetworkSample[] = []
  const pending = new Set<Request>()
  const supabaseHost = envUrlHost('NEXT_PUBLIC_SUPABASE_URL')

  const onRequest = (request: Request) => {
    pending.add(request)
  }
  const onComplete = (request: Request) => {
    pending.delete(request)
    const timing = request.timing()
    samples.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      startTime: timing.startTime,
      responseStart: timing.responseStart,
      responseEnd: timing.responseEnd,
      durationMs: Math.max(0, timing.responseEnd - timing.startTime),
    })
  }
  const onFailed = (request: Request) => {
    pending.delete(request)
    const failure = request.failure()
    if (failure && isIgnorableFailedRequest(request.url(), failure.errorText)) return
    if (failure) errors.push(`${request.method()} ${redactUrl(request.url())} failed: ${failure.errorText}`)
  }
  const onResponse = (response: Response) => {
    const request = response.request()
    const status = response.status()
    if (status >= 400 && !isIgnorableSubrequest(response.url())) {
      errors.push(`${request.method()} ${redactUrl(response.url())} returned HTTP ${status}`)
    }
  }

  page.on('request', onRequest)
  page.on('requestfinished', onComplete)
  page.on('requestfailed', onFailed)
  page.on('response', onResponse)

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })
    await waitForNetworkQuiet(page, pending, 700, 12_000).catch(() => {
      // Some production pages keep streaming, analytics, or realtime requests open.
      // The elapsed appStableMs still captures the timeout cost; do not fail the route for this alone.
    })

    const navigation = await page.evaluate(async () => {
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)

      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      return {
        now: performance.now(),
        navigation: nav
          ? {
              responseStart: nav.responseStart,
              domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
              loadEventEnd: nav.loadEventEnd,
              transferSize: nav.transferSize,
              encodedBodySize: nav.encodedBodySize,
            }
          : null,
        resources: resources.map((entry) => ({
          name: entry.name,
          initiatorType: entry.initiatorType,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
        })),
      }
    })

    const resources = navigation.resources
    const jsResources = resources.filter(isJavaScriptResource)
    const nextStaticResources = resources.filter((resource) => resource.name.includes('/_next/static/'))
    const routeResources = resources.filter(isRouteResource)
    const rscResources = resources.filter(isRscResource)
    const supabaseSamples = samples.filter((sample) => isSupabaseUrl(sample.url, supabaseHost))

    const result: RouteBenchmark = {
      name: route.name,
      path: route.path,
      url: response?.url() ?? url,
      status: response?.status() ?? null,
      ttfbMs: navigation.navigation?.responseStart ?? null,
      domContentLoadedMs: navigation.navigation?.domContentLoadedEventEnd ?? null,
      loadMs: navigation.navigation?.loadEventEnd ?? null,
      appStableMs: navigation.now,
      jsBytes: sumResourceBytes(jsResources),
      jsRequests: jsResources.length,
      nextStaticBytes: sumResourceBytes(nextStaticResources),
      nextStaticRequests: nextStaticResources.length,
      routeBytes: sumResourceBytes(routeResources),
      routeRequests: routeResources.length,
      rscBytes: sumResourceBytes(rscResources),
      rscRequests: rscResources.length,
      supabaseRequests: supabaseSamples.length,
      supabaseDurationMs: round(sum(supabaseSamples.map((sample) => sample.durationMs))),
      supabaseMaxDurationMs: round(Math.max(0, ...supabaseSamples.map((sample) => sample.durationMs))),
      transferBytes: sumResourceBytes(resources) + (navigation.navigation?.transferSize ?? 0),
      resourceCount: resources.length,
      errors,
    }

    await testInfo.attach(`${route.name}-perf`, {
      contentType: 'application/json',
      body: JSON.stringify(result, null, 2),
    })

    return result
  } finally {
    page.off('request', onRequest)
    page.off('requestfinished', onComplete)
    page.off('requestfailed', onFailed)
    page.off('response', onResponse)
  }
}

export async function writePerfReport(report: PerfReport) {
  const path = perfOutputPath()
  await mkdir(dirname(path), { recursive: true })
  const existing = await readExistingResults(path)
  const routesByName = new Map<string, RouteBenchmark>()

  for (const route of existing?.routes ?? []) {
    routesByName.set(route.name, route)
  }
  for (const route of report.routes) {
    routesByName.set(route.name, route)
  }

  const mergedReport: PerfReport = {
    ...report,
    routes: [...routesByName.values()],
  }

  const tempPath = `${path}.${process.pid}.tmp`
  await writeFile(tempPath, `${JSON.stringify(mergedReport, null, 2)}\n`)
  await rename(tempPath, path)
}

export async function readExistingResults(path = perfOutputPath()) {
  try {
    const text = await readFile(path, 'utf8')
    return JSON.parse(text) as PerfReport
  } catch {
    return null
  }
}

export async function resolveAthletePath(page: Page) {
  if (process.env.PERF_ATHLETE_PATH) return process.env.PERF_ATHLETE_PATH
  if (process.env.PERF_ATHLETE_ID) return `/athletes/${process.env.PERF_ATHLETE_ID}`

  await page.goto('/athletes', { waitUntil: 'domcontentloaded' })
  await page.locator('body').waitFor({ state: 'visible', timeout: 10_000 })

  const href = await page
    .locator('a[href*="/athletes/"]')
    .evaluateAll((anchors) => {
      const anchor = anchors.find((node) => {
        const href = (node as HTMLAnchorElement).href
        return /\/athletes\/[^/?#]+/.test(href)
      }) as HTMLAnchorElement | undefined

      return anchor?.href ?? null
    })
    .catch(() => null)

  if (!href && process.env.PERF_SEEDED_ATHLETE_PATH) return process.env.PERF_SEEDED_ATHLETE_PATH
  if (!href) return null

  const parsed = new URL(href)
  return `${parsed.pathname}${parsed.search}`
}

export function absoluteUrl(baseURL: string, path: string) {
  return new URL(path, baseURL).toString()
}

async function waitForNetworkQuiet(page: Page, pending: Set<Request>, quietMs: number, timeoutMs: number) {
  const startedAt = Date.now()
  let quietStartedAt = pending.size === 0 ? Date.now() : 0

  while (Date.now() - startedAt < timeoutMs) {
    if (page.isClosed()) throw new Error('page closed before network became quiet')
    if (pending.size === 0) {
      quietStartedAt ||= Date.now()
      if (Date.now() - quietStartedAt >= quietMs) return
    } else {
      quietStartedAt = 0
    }
    await page.waitForTimeout(100)
  }

  throw new Error(`${pending.size} browser requests were still pending after ${timeoutMs}ms`)
}

function isJavaScriptResource(resource: ResourceSample) {
  return (
    resource.initiatorType === 'script' ||
    resource.name.endsWith('.js') ||
    resource.name.includes('.js?') ||
    resource.name.includes('/_next/static/chunks/')
  )
}

function isRouteResource(resource: ResourceSample) {
  return (
    resource.initiatorType === 'fetch' ||
    resource.name.includes('/_next/data/') ||
    resource.name.includes('/api/') ||
    isRscResource(resource)
  )
}

function isRscResource(resource: ResourceSample) {
  return (
    resource.name.includes('_rsc=') ||
    resource.name.includes('__flight__') ||
    resource.name.endsWith('.rsc') ||
    resource.name.includes('.rsc?')
  )
}

function sumResourceBytes(resources: ResourceSample[]) {
  return sum(resources.map((resource) => resource.transferSize || resource.encodedBodySize || resource.decodedBodySize || 0))
}

function isSupabaseUrl(url: string, configuredHost: string | null) {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === configuredHost ||
      parsed.hostname.endsWith('.supabase.co') ||
      parsed.hostname.includes('supabase')
    )
  } catch {
    return false
  }
}

function isIgnorableSubrequest(url: string) {
  return /\/favicon\.ico(?:\?|$)/.test(url)
}

function isIgnorableFailedRequest(url: string, errorText: string) {
  if (errorText !== 'net::ERR_ABORTED') return false
  return (
    isRscResource({ name: url, initiatorType: '', transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 }) ||
    /\/storage\/v1\/object\/sign\/athlete-photos\//.test(url)
  )
}

function redactUrl(url: string) {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url
  }
}

function envUrlHost(name: string) {
  const value = envValue(name)
  if (!value) return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function hasAuthInputs(emailName: string, passwordName: string) {
  return Boolean(
    envValue(emailName) &&
      envValue(passwordName) &&
      envValue('NEXT_PUBLIC_SUPABASE_URL') &&
      envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
}

function envValue(name: string) {
  if (process.env[name]) return process.env[name]

  for (const path of ['.env.local', 'apps/admin/.env.local']) {
    try {
      const envFile = readFileSync(path, 'utf8')
      const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'))
      if (match?.[1]) return match[1].trim().replace(/^['"]|['"]$/g, '')
    } catch {
      // Optional local environment files are not required for remote perf runs.
    }
  }

  return undefined
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function sanitizeLabel(label: string) {
  return label.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'local'
}
