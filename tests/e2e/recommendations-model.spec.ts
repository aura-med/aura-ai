import { expect, test } from '@playwright/test'

const SEEDED_SQUAD_WITH_AVAILABLE_ATHLETES = '9b8cd13c-11cc-4e97-8e13-9c88d814afb8'

test.describe('recommendations model critical fixes', () => {
  test.setTimeout(60_000)

  test('wellness save triggers score recalculation and recommendations can be acknowledged', async ({ page }) => {
    await page.goto(`/input?squadId=${SEEDED_SQUAD_WITH_AVAILABLE_ATHLETES}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    const saveButton = page.getByRole('button', { name: /^Guardar$/i })
    await expect(saveButton).toBeVisible()

    const selectedAthleteId = await page.locator('#athlete-input-select').inputValue()
    expect(selectedAthleteId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    const scoreResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/athletes/${selectedAthleteId}/score`) &&
      response.request().method() === 'POST'
    )

    await saveButton.click()
    const scoreResponse = await scoreResponsePromise
    expect(scoreResponse.ok()).toBe(true)

    const scorePayload = await scoreResponse.json()
    expect(scorePayload.recommendationLogId).toBeTruthy()
    expect(scorePayload.recommendationLogError).toBeNull()

    await page.goto(`/athletes/${selectedAthleteId}?squadId=${SEEDED_SQUAD_WITH_AVAILABLE_ATHLETES}&tab=recommendations`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Baixo Risco|Risco Moderado|Risco Elevado|Risco Crítico/)).toBeVisible()

    const acknowledgeButton = page.getByRole('button', { name: 'Marcar como visto' })
    await expect(acknowledgeButton).toBeVisible()

    await acknowledgeButton.click()
    await expect(page.getByRole('button', { name: /Visto/ })).toBeVisible()
  })
})
