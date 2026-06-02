import { expect, type Page, test } from '@playwright/test'

import {
  absoluteUrl,
  adminBaseURL,
  benchmarkRoute,
  hasAdminAuthState,
  hasMainAuthState,
  perfLabel,
  resolveAthletePath,
  type PerfReport,
  type RouteBenchmark,
  writePerfReport,
} from './metrics'

const mainRoutes = [
  { name: 'dashboard', path: '/' },
  { name: 'readiness', path: '/readiness' },
  { name: 'passport', path: '/passport' },
  { name: 'calendar', path: '/calendar' },
  { name: 'load', path: '/load' },
  { name: 'rehab', path: '/rehab' },
  { name: 'clinical-portal', path: '/clinical-portal' },
  { name: 'input-scoring', path: '/input?squadId=9b8cd13c-11cc-4e97-8e13-9c88d814afb8' },
  { name: 'athletes', path: '/athletes' },
]

const athleteTabs = ['overview', 'medical', 'injuries', 'treatments', 'documents', 'recommendations']

const adminRoutes = [
  { name: 'admin-dashboard', path: '/' },
  { name: 'admin-analytics', path: '/analytics' },
  { name: 'admin-users', path: '/users' },
  { name: 'admin-organizations', path: '/organizations' },
  { name: 'admin-injuries', path: '/injuries' },
  { name: 'admin-protocols', path: '/protocols' },
  { name: 'admin-operations', path: '/operations' },
  { name: 'admin-security', path: '/security' },
  { name: 'admin-settings', path: '/settings' },
]

const results: RouteBenchmark[] = []

test.afterAll(async ({}, testInfo) => {
  const metadata = testInfo.config.metadata as { perf?: { baseURL?: string; adminBaseURL?: string } }
  const report: PerfReport = {
    label: perfLabel(),
    generatedAt: new Date().toISOString(),
    baseURL: metadata.perf?.baseURL ?? null,
    adminBaseURL: metadata.perf?.adminBaseURL ?? adminBaseURL() ?? null,
    routes: results,
  }

  await writePerfReport(report)
})

test.describe('main app route benchmarks', () => {
  test.skip(!hasMainAuthState(), 'Set E2E_USER_EMAIL/E2E_USER_PASSWORD or provide tests/.auth/perf-main.json')

  for (const route of mainRoutes) {
    test(`${route.name} route`, async ({ page }, testInfo) => {
      const result = await benchmarkRoute(page, route, testInfo)
      await expectAuthenticatedBenchmarkPage(page, result)
      results.push(result)
    })
  }

  test('dynamic athlete profile tabs', async ({ page }, testInfo) => {
    const athletePath = await resolveAthletePath(page)
    if (!athletePath) {
      test.skip(true, 'No athlete profile link found on /athletes and no PERF_ATHLETE_ID/PERF_ATHLETE_PATH provided')
      return
    }

    for (const tab of athleteTabs) {
      const tabPath = withAthleteTab(athletePath, tab)
      const result = await benchmarkRoute(page, { name: `athlete-profile-${tab}`, path: tabPath }, testInfo)
      await expectAuthenticatedBenchmarkPage(page, result)
      results.push(result)
    }
  })
})

test.describe('admin route benchmarks', () => {
  const adminURL = adminBaseURL()
  test.skip(!adminURL, 'Set AURA_ADMIN_BASE_URL to benchmark admin routes')
  test.skip(!hasAdminAuthState(), 'Set admin auth env vars or provide tests/.auth/perf-admin.json')

  for (const route of adminRoutes) {
    test(`${route.name} route`, async ({ browser }, testInfo) => {
      if (!adminURL) {
        test.skip(true, 'Set AURA_ADMIN_BASE_URL to benchmark admin routes')
        return
      }

      const context = await browser.newContext({ storageState: 'tests/.auth/perf-admin.json' })
      const page = await context.newPage()
      try {
        const result = await benchmarkRoute(
          page,
          {
            name: route.name,
            path: route.path,
            url: absoluteUrl(adminURL, route.path),
          },
          testInfo,
        )
        await expectAuthenticatedBenchmarkPage(page, result)
        results.push(result)
      } finally {
        await context.close()
      }
    })
  }
})

function withAthleteTab(path: string, tab: string) {
  const url = new URL(path, 'http://perf.local')
  url.searchParams.set('tab', tab)
  return `${url.pathname}${url.search}`
}

async function expectAuthenticatedBenchmarkPage(page: Page, result: RouteBenchmark) {
  expect(result.status, result.path).not.toBeNull()
  expect(result.status, result.path).toBeGreaterThanOrEqual(200)
  expect(result.status, result.path).toBeLessThan(300)
  expect(new URL(result.url, 'http://perf.local').pathname, result.path).not.toMatch(/^\/(login|auth|signin)\b/i)
  expect.soft(result.errors, result.path).toEqual([])
  await expect(page.locator('body'), result.path).not.toContainText(/Acesso restrito|Entrar|Login|Sign in/i)
}
