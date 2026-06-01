import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000'
const localEnv = loadLocalEnv()

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    env: localEnv,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/fisio.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: 'tests/.auth/fisio.json',
      },
      dependencies: ['setup'],
    },
  ],
})

function loadLocalEnv() {
  const env: Record<string, string> = {}

  for (const path of ['.env.local', 'apps/admin/.env.local']) {
    try {
      const envFile = readFileSync(path, 'utf8')
      for (const line of envFile.split(/\r?\n/)) {
        if (!line || line.startsWith('#') || !line.includes('=')) continue
        const index = line.indexOf('=')
        const key = line.slice(0, index)
        env[key] = process.env[key] ?? line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      }
    } catch {
      // Local env files are optional in CI and deployment environments.
    }
  }

  return env
}
