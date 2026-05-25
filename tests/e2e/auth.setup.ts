import { createServerClient } from '@supabase/ssr'
import { test as setup } from '@playwright/test'
import { readFileSync } from 'node:fs'

const authFile = 'tests/.auth/fisio.json'

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

setup('authenticate seeded user', async ({ baseURL }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!email || !password) {
    throw new Error('Set E2E_USER_EMAIL and E2E_USER_PASSWORD before running Playwright')
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or provide .env.local')
  }

  const appUrl = new URL(baseURL ?? 'http://127.0.0.1:3000')
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

  await writeStorageState(authFile, cookies, appUrl)
})

async function writeStorageState(path: string, cookies: CookieToSet[], appUrl: URL) {
  const { writeFile, mkdir } = await import('node:fs/promises')

  await mkdir('tests/.auth', { recursive: true })
  await writeFile(
    path,
    JSON.stringify({
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
    }),
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

  try {
    const envFile = readFileSync('.env.local', 'utf8')
    const match = envFile.match(new RegExp(`^${name}=(.*)$`, 'm'))
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  } catch {
    return undefined
  }
}
