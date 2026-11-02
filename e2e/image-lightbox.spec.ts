import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('image lightbox from Visuals', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('visuals', 4355)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('opens a large view that fits the window, keeps the comparison modes and closes with Esc', async ({ page }) => {
    await openReview(page, served.url)
    const pair = page.getByTestId('intent-visual').nth(1)
    const trigger = pair.getByTestId('enlarge-image')
    await trigger.click()

    const lightbox = page.locator('dialog[open]')
    await expect(lightbox).toBeVisible()
    const box = (await lightbox.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)

    for (const mode of ['Side by side', 'Swipe', 'Onion skin', 'Changed pixels']) {
      await lightbox.getByRole('button', { name: mode }).click()
    }
    await expect(lightbox.locator('canvas')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(lightbox).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('closes with a click outside the large view and returns focus to the image', async ({ page }) => {
    await openReview(page, served.url)
    const trigger = page.getByTestId('intent-visual').nth(0).getByTestId('enlarge-image')
    await trigger.click()
    const lightbox = page.locator('dialog[open]')
    await expect(lightbox).toBeVisible()
    await expect(lightbox.locator('img')).toHaveCount(1)

    await page.mouse.click(3, 3)
    await expect(lightbox).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe('image lightbox from a proof link', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('proof-link', 4356)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('enlarges the proof image with before and after modes', async ({ page }) => {
    await openReview(page, served.url)
    await page.locator('#file-src-components-Logo-vue').getByTestId('proof-icon').click()
    const trigger = page.getByTestId('proof-popover').getByTestId('enlarge-image')
    await trigger.click()

    const lightbox = page.locator('dialog[open]')
    await expect(lightbox).toBeVisible()
    await expect(lightbox.getByRole('button', { name: 'Swipe' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(lightbox).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
