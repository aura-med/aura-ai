import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const SELECTED_SQUAD_ID = '9b8cd13c-11cc-4e97-8e13-9c88d814afb8'

type Relation<T> = T | T[] | null

type RehabRow = {
  id: string
  athletes: Relation<{ name: string; squad_id: string | null }>
}

type AthleteRow = {
  id: string
  name: string
  squad_id: string | null
}

let expected: {
  selectedRehabNames: string[]
  otherRehabNames: string[]
  selectedAthleteIds: string[]
  otherAthleteIds: string[]
}

test.beforeAll(async () => {
  expected = await fetchExpectedSquadData()
  expect(expected.selectedRehabNames.length).toBeGreaterThan(0)
})

test.describe('rehab squad scoping', () => {
  test('rehab list only shows selected squad and keeps squadId when opening details', async ({ page }) => {
    const navigationErrors: string[] = []
    page.on('pageerror', (error) => {
      if (/headCacheNode|Should not already be working/i.test(error.message)) {
        navigationErrors.push(error.message)
      }
    })

    await page.goto(`/rehab?squadId=${SELECTED_SQUAD_ID}`, { waitUntil: 'networkidle' })
    const table = page.locator('tbody')
    await expect(table).toBeVisible()

    for (const name of expected.selectedRehabNames) {
      await expect(table.locator('tr', { hasText: name })).toHaveCount(1)
    }

    for (const name of expected.otherRehabNames) {
      await expect(table.locator('tr', { hasText: name })).toHaveCount(0)
    }

    await page.getByRole('link', { name: /Abrir/i }).first().click()
    await page.waitForURL((url) =>
      /^\/rehab\/[^/]+$/.test(url.pathname) &&
      url.searchParams.get('squadId') === SELECTED_SQUAD_ID
    )

    const url = new URL(page.url())
    expect(url.pathname).toMatch(/^\/rehab\/[^/]+$/)
    expect(url.searchParams.get('squadId')).toBe(SELECTED_SQUAD_ID)
    await expect(page.locator('body')).toContainText(/Fases do Protocolo|Critérios RTP|Reabilitação/i)
    expect(navigationErrors).toEqual([])
  })

  test('sidebar navigation preserves selected squadId', async ({ page }) => {
    await page.goto(`/rehab?squadId=${SELECTED_SQUAD_ID}`, { waitUntil: 'networkidle' })

    for (const linkName of [/Prontid/i, /Plantel/i, /Portal Clínico/i, /Reabilitação/i]) {
      await openMobileSidebarIfNeeded(page)
      await page.getByRole('link', { name: linkName }).click()
      await page.waitForURL((url) => url.searchParams.get('squadId') === SELECTED_SQUAD_ID)
      expect(new URL(page.url()).searchParams.get('squadId')).toBe(SELECTED_SQUAD_ID)
    }
  })

  test('clinical portal sessions and injury modal athletes are selected-squad scoped', async ({ page }) => {
    await page.goto(`/clinical-portal?squadId=${SELECTED_SQUAD_ID}`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: /Clinical Portal/i })).toBeVisible()

    const table = page.locator('tbody')
    await expect(table).toBeVisible()

    for (const name of expected.selectedRehabNames) {
      await expect(table.locator('tr', { hasText: name })).toHaveCount(1)
    }

    for (const name of expected.otherRehabNames) {
      await expect(table.locator('tr', { hasText: name })).toHaveCount(0)
    }

    await page.getByRole('button', { name: /Registar Lesão/i }).click()
    const athleteSelect = page.getByLabel('Atleta')

    for (const athleteId of expected.selectedAthleteIds) {
      await expect(athleteSelect.locator(`option[value="${athleteId}"]`)).toHaveCount(1)
    }

    for (const athleteId of expected.otherAthleteIds) {
      await expect(athleteSelect.locator(`option[value="${athleteId}"]`)).toHaveCount(0)
    }
  })
})

async function fetchExpectedSquadData() {
  const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const email = env('E2E_USER_EMAIL')
  const password = env('E2E_USER_PASSWORD')

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
    throw new Error('Set Supabase env plus E2E_USER_EMAIL/E2E_USER_PASSWORD before running rehab squad E2E tests')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })

  const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) throw new Error(`Supabase login failed for ${email}: ${authError.message}`)

  const [{ data: rehabData, error: rehabError }, { data: athleteData, error: athleteError }] = await Promise.all([
    supabase
      .from('rehab_sessions')
      .select(`
        id,
        athletes!inner(name, squad_id, active)
      `)
      .not('protocol_id', 'is', null)
      .eq('athletes.active', true)
      .order('updated_at', { ascending: false }),
    supabase
      .from('athletes')
      .select('id, name, squad_id')
      .eq('active', true)
      .order('shirt_number'),
  ])

  if (rehabError) throw new Error(`Failed to query rehab sessions: ${rehabError.message}`)
  if (athleteError) throw new Error(`Failed to query athletes: ${athleteError.message}`)

  const rehabRows = (rehabData ?? []) as unknown as RehabRow[]
  const athleteRows = (athleteData ?? []) as unknown as AthleteRow[]

  return {
    selectedRehabNames: uniqueNames(rehabRows.filter((row) => firstRelation(row.athletes)?.squad_id === SELECTED_SQUAD_ID).map((row) => firstRelation(row.athletes)?.name)),
    otherRehabNames: uniqueNames(rehabRows.filter((row) => firstRelation(row.athletes)?.squad_id !== SELECTED_SQUAD_ID).map((row) => firstRelation(row.athletes)?.name)),
    selectedAthleteIds: athleteRows.filter((row) => row.squad_id === SELECTED_SQUAD_ID).map((row) => row.id),
    otherAthleteIds: athleteRows.filter((row) => row.squad_id !== SELECTED_SQUAD_ID).map((row) => row.id),
  }
}

function firstRelation<T>(relation: Relation<T>): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}

function uniqueNames(names: Array<string | null | undefined>) {
  return [...new Set(names.filter((name): name is string => Boolean(name)))]
}

async function openMobileSidebarIfNeeded(page: Page) {
  const menuButton = page.getByRole('button', { name: /toggle menu/i })
  if (await menuButton.isVisible()) {
    await menuButton.click()
  }
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
