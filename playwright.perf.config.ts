import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

const mainAuthFile = 'tests/.auth/perf-main.json'
const localEnv = loadLocalEnv()
const baseURL = env('PLAYWRIGHT_BASE_URL') ?? 'http://127.0.0.1:3000'
const adminBaseURL =
  env('AURA_ADMIN_BASE_URL') ??
  (env('PERF_START_ADMIN_SERVER') === '1' ? 'http://127.0.0.1:3001' : undefined)

const hasMainAuthInputs = Boolean(
  env('E2E_USER_EMAIL') &&
    env('E2E_USER_PASSWORD') &&
    env('NEXT_PUBLIC_SUPABASE_URL') &&
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
)

const webServers: Array<{
  command: string
  env: Record<string, string>
  url: string
  reuseExistingServer: boolean
  timeout: number
}> = []

if (!env('PLAYWRIGHT_BASE_URL')) {
  webServers.push({
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    env: localEnv,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })
}

if (env('PERF_START_ADMIN_SERVER') === '1' && !env('AURA_ADMIN_BASE_URL') && adminBaseURL) {
  webServers.push({
    command: 'npm run admin:dev -- --hostname 127.0.0.1 --port 3001',
    env: localEnv,
    url: adminBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  })
}

export default defineConfig({
  testDir: './tests/perf',
  timeout: 75_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: webServers.length > 0 ? webServers : undefined,
  projects: [
    {
      name: 'perf-auth',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'perf-chromium',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: hasMainAuthInputs || existsSync(mainAuthFile) ? mainAuthFile : undefined,
      },
      dependencies: ['perf-auth'],
    },
  ],
  metadata: {
    perf: {
      label: process.env.PERF_LABEL ?? 'local',
      baseURL,
      adminBaseURL,
      remoteMain: Boolean(env('PLAYWRIGHT_BASE_URL')),
      remoteAdmin: Boolean(env('AURA_ADMIN_BASE_URL')),
    },
  },
})

function loadLocalEnv() {
  const loaded: Record<string, string> = {}

  for (const path of ['.env.local', 'apps/admin/.env.local']) {
    try {
      const envFile = readFileSync(path, 'utf8')
      for (const line of envFile.split(/\r?\n/)) {
        if (!line || line.startsWith('#') || !line.includes('=')) continue
        const index = line.indexOf('=')
        const key = line.slice(0, index)
        loaded[key] = process.env[key] ?? line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      }
    } catch {
      // Local env files are optional in CI and deployment environments.
    }
  }

  return loaded
}

function env(name: string) {
  return process.env[name] ?? localEnv[name]
}
