import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

test('topbar theme toggle changes theme and persists after refresh', async ({ page }) => {
  await page.goto('/readiness', { waitUntil: 'networkidle' })

  const toggle = page.getByRole('button', { name: /toggle theme/i }).filter({ visible: true }).first()
  await expect(toggle).toBeEnabled()

  const before = await currentTheme(page)
  await toggle.click()

  await expect
    .poll(() => currentTheme(page), { message: 'theme class changes after toggling' })
    .not.toBe(before)
  const after = await currentTheme(page)

  await page.reload({ waitUntil: 'networkidle' })
  await expect.poll(() => currentTheme(page), { message: 'theme class persists after reload' }).toBe(after)
})

test('login page renders English auth copy without missing-message errors', async ({ browser, baseURL }) => {
  const appUrl = new URL(baseURL ?? 'http://127.0.0.1:3000')
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  })
  await context.addCookies([
    {
      name: 'NEXT_LOCALE',
      value: 'en',
      domain: appUrl.hostname,
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: false,
      secure: appUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()

  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/login', { waitUntil: 'networkidle' })

  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  expect(consoleErrors.filter((message) => message.includes('MISSING_MESSAGE'))).toEqual([])

  await context.close()
})

test('topbar theme toggle persists the preference to user_preferences when service role is available', async ({ page }) => {
  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
  const email = process.env.E2E_USER_EMAIL

  test.skip(!supabaseUrl || !serviceRoleKey || !email, 'Supabase service credentials are required for DB persistence assertion')

  await page.goto('/readiness', { waitUntil: 'networkidle' })

  const toggle = page.getByRole('button', { name: /toggle theme/i }).filter({ visible: true }).first()
  await expect(toggle).toBeEnabled()
  const before = await currentTheme(page)
  await toggle.click()

  await expect
    .poll(() => currentTheme(page), { message: 'theme class changes before DB assertion' })
    .not.toBe(before)
  const selectedTheme = await currentTheme(page)

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, { auth: { persistSession: false } })
  const userId = await findUserIdByEmail(supabase, email!)

  await expect
    .poll(async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', userId)
        .single()

      if (error) return `error:${error.message}`
      return data?.theme
    }, { message: 'user_preferences.theme matches selected UI theme' })
    .toBe(selectedTheme)
})

async function currentTheme(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const root = document.documentElement
    if (root.classList.contains('light')) return 'light'
    if (root.classList.contains('dark')) return 'dark'
    return ''
  })
}

async function findUserIdByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(error.message)

  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) throw new Error(`Could not find E2E user ${email}`)
  return user.id
}

function env(name: string) {
  if (process.env[name]) return process.env[name]

  try {
    const envFile = readFileSync('.env.local', 'utf8')
    const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  } catch {
    return undefined
  }
}
