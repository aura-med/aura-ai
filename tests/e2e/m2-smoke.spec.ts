import { expect, test } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')

const m2Routes = [
  { path: '/readiness', label: /Prontidao|A carregar/i },
  { path: '/rehab', label: /Reabilitacao|A carregar/i },
  { path: '/passport', label: /Passaporte|A carregar/i },
  { path: '/input', label: /Input|Wellness|A carregar/i },
  { path: '/calendar', label: /Calendar Intelligence|Calendario|A carregar/i },
]

test.describe('M2 server-first routes', () => {
  for (const route of m2Routes) {
    test(`${route.path} renders without a server error`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })

      expect(response?.status(), route.path).toBeLessThan(500)
      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('body')).toContainText(new RegExp(`${route.label.source}|Acesso restrito`, 'i'))
    })
  }

  test('notifications popover is keyboard dismissible when available', async ({ page }) => {
    await page.goto('/readiness', { waitUntil: 'networkidle' })

    const trigger = page.getByRole('button', { name: /notific/i }).filter({ visible: true })
    if ((await trigger.count()) === 0) return

    await expect(trigger.first()).toBeEnabled()
    await trigger.first().focus()
    await trigger.first().press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(trigger.first()).toBeFocused()
  })
})

test.describe('M2 accessibility', () => {
  for (const route of m2Routes) {
    test(`${route.path} has no critical axe violations`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'networkidle' })
      await page.addScriptTag({ path: axePath })

      const violations = await page.evaluate(async () => {
        const results = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa'],
          },
        })

        return results.violations
          .filter((violation) => violation.impact === 'critical')
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.target.join(' ')),
          }))
      })

      expect(violations).toEqual([])
    })
  }
})

declare global {
  interface Window {
    axe: {
      run: (
        context: Document,
        options: {
          runOnly: {
            type: string
            values: string[]
          }
        }
      ) => Promise<{
        violations: Array<{
          id: string
          impact: string | null
          nodes: Array<{ target: string[] }>
        }>
      }>
    }
  }
}
