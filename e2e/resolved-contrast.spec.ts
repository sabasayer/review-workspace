import { test, expect } from '@playwright/test'
import { contrastRatio, type Rgb } from '../ui/src/contrast.ts'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

function parseCssColor(value: string): Rgb {
  return value.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number) as unknown as Rgb
}

test.describe('Resolved checkbox contrast', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4358)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`checkbox border, divider and label meet contrast in the ${theme} theme`, async ({ page }) => {
      await openReview(page, served.url)
      await page.emulateMedia({ colorScheme: theme })
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/)

      const note = page.getByTestId('inline-note').filter({ hasText: 'Rejects further attempts' })
      await note.getByRole('button').first().click()
      const checkbox = note.getByRole('checkbox', { name: 'Resolved' })
      const row = checkbox.locator('xpath=ancestor::div[contains(@class,"border-t")][1]')

      const colors = await row.evaluate((el) => ({
        divider: getComputedStyle(el).borderTopColor,
        ring: getComputedStyle(el.querySelector('button[role="checkbox"]')!).boxShadow,
        label: getComputedStyle(el.querySelector('label')!).color,
        surface: getComputedStyle(document.body).backgroundColor,
      }))
      const surface = parseCssColor(colors.surface)
      const ring = parseCssColor(colors.ring.match(/(rgba?\([^)]*\)) 0px 0px 0px \d+px inset/)![1])

      expect(contrastRatio(ring, surface)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(parseCssColor(colors.divider), surface)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(parseCssColor(colors.label), surface)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
