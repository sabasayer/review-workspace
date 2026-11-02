import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('proof icon', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('proof-link', 4337)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('opens the proof image with its caption and links back from the image file to the code', async ({ page }) => {
    await openReview(page, served.url)
    const codeFile = page.locator('#file-src-components-Logo-vue')
    const icon = codeFile.getByTestId('proof-icon')
    await expect(icon).toHaveCount(1)
    await icon.click()

    const popover = page.getByTestId('proof-popover')
    await expect(popover).toContainText('The changed snapshot shows the new logo.')
    await expect(popover.locator('img')).toHaveCount(2)
    const loaded = await popover.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))
    expect(loaded).toBe(true)

    await page.keyboard.press('Escape')
    const imageFile = page.locator('#file-assets-logo-png')
    const back = imageFile.getByTestId('proof-back-links')
    await expect(back).toContainText('src/components/Logo.vue')
    await back.getByRole('button').click()
    await expect(codeFile).toBeInViewport()
  })

  test('shows no icon on a file without proofs', async ({ page }) => {
    await openReview(page, served.url)
    await expect(page.locator('#file-assets-logo-png').getByTestId('proof-icon')).toHaveCount(0)
  })
})
