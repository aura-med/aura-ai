import { createServerClient } from '@supabase/ssr'
import { test as setup } from '@playwright/test'
import { readFileSync } from 'node:fs'

const mainAuthFile = 'tests/.auth/perf-main.json'
const adminAuthFile = 'tests/.auth/perf-admin.json'

type CookieToSet = {
  name: string
  value: string
  options?: {
    domain?: string
    path?: string
    expires?: Date
    maxAge?: number
    httpOnly?: boolean
    secure?: boolean
    sameSite?: boolean | 'lax' | 'strict' | 'none'
  }
}

setup('authenticate perf main user', async ({ baseURL }) => {
  const email = env('E2E_USER_EMAIL')
  const password = env('E2E_USER_PASSWORD')
  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!email || !password) {
    setup.skip(true, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to benchmark authenticated app routes')
    return
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    setup.skip(true, 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to create auth state')
    return
  }

  await writeSupabaseStorageState({
    authFile: mainAuthFile,
    appUrl: new URL(baseURL ?? 'http://127.0.0.1:3000'),
    email,
    password,
    supabaseUrl,
    supabaseAnonKey,
  })
})

setup('authenticate perf admin user', async () => {
  const adminBaseURL = env('AURA_ADMIN_BASE_URL') ??
    (env('PERF_START_ADMIN_SERVER') === '1' ? 'http://127.0.0.1:3001' : undefined)
  const email = env('AURA_ADMIN_EMAIL') ?? env('E2E_ADMIN_EMAIL')
  const password = env('AURA_ADMIN_PASSWORD') ?? env('E2E_ADMIN_PASSWORD')
  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!adminBaseURL) {
    setup.skip(true, 'Set AURA_ADMIN_BASE_URL to enable admin route benchmarks')
    return
  }
  if (!email || !password) {
    setup.skip(true, 'Set AURA_ADMIN_EMAIL/AURA_ADMIN_PASSWORD or E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD for admin auth')
    return
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    setup.skip(true, 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to create admin auth state')
    return
  }

  await writeSupabaseStorageState({
    authFile: adminAuthFile,
    appUrl: new URL(adminBaseURL),
    email,
    password,
    supabaseUrl,
    supabaseAnonKey,
  })
})

async function writeSupabaseStorageState({
  authFile,
  appUrl,
  email,
  password,
  supabaseUrl,
  supabaseAnonKey,
}: {
  authFile: string
  appUrl: URL
  email: string
  password: string
  supabaseUrl: string
  supabaseAnonKey: string
}) {
  const { mkdir, writeFile } = await import('node:fs/promises')
  let cookies: CookieToSet[] = []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookies
      },
      setAll(cookiesToSet) {
        cookies = mergeCookies(cookies, cookiesToSet)
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Supabase login failed for ${email}: ${error.message}`)
  }

  await mkdir('tests/.auth', { recursive: true })
  await writeFile(
    authFile,
    JSON.stringify(
      {
        cookies: cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: appUrl.hostname,
          path: cookie.options?.path ?? '/',
          expires: cookie.options?.expires
            ? Math.floor(cookie.options.expires.getTime() / 1000)
            : cookie.options?.maxAge
              ? Math.floor(Date.now() / 1000) + cookie.options.maxAge
              : -1,
          httpOnly: cookie.options?.httpOnly ?? false,
          secure: cookie.options?.secure ?? appUrl.protocol === 'https:',
          sameSite: normalizeSameSite(cookie.options?.sameSite),
        })),
        origins: [],
      },
      null,
      2,
    ),
  )
}

function mergeCookies(current: CookieToSet[], next: CookieToSet[]) {
  const byName = new Map(current.map((cookie) => [cookie.name, cookie]))
  for (const cookie of next) {
    byName.set(cookie.name, cookie)
  }
  return [...byName.values()]
}

type SameSiteOption = NonNullable<CookieToSet['options']>['sameSite']

function normalizeSameSite(value: SameSiteOption | undefined) {
  if (value === 'strict') return 'Strict'
  if (value === 'none') return 'None'
  return 'Lax'
}

function env(name: string) {
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
