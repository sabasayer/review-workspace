import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('Intent visuals', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('visuals', 4334)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('shows the MR image first and the snapshot as one before/after pair, each with a caption', async ({ page }) => {
    await openReview(page, served.url)
    const visuals = page.getByTestId('intent-visuals')
    const figures = visuals.getByTestId('intent-visual')
    await expect(figures).toHaveCount(2)
    await expect(figures.nth(0).locator('figcaption')).toHaveText('Screenshot from the MR text.')
    await expect(figures.nth(1).locator('figcaption')).toHaveText('Changed snapshot of the login page.')
    await expect(figures.nth(1).getByText('Before', { exact: true })).toBeVisible()
    await expect(figures.nth(1).getByText('After', { exact: true })).toBeVisible()
    await expect(figures.nth(1).locator('img')).toHaveCount(2)
    await expect(visuals.getByTestId('more-visuals')).toHaveCount(0)
    const loaded = await visuals.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))
    expect(loaded).toBe(true)
  })
})

test.describe('Intent visuals layout', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('visuals', 4354)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('puts the images in their own row below the text, with no right column', async ({ page }) => {
    await openReview(page, served.url)
    const panel = page.getByTestId('intent-panel')
    const panelBox = (await panel.boundingBox())!
    const visualsBox = (await page.getByTestId('intent-visuals').boundingBox())!
    const whyBox = (await panel.getByText('Stops brute-force attacks.').boundingBox())!
    const doesBox = (await panel.getByText('Adds a limit on login attempts.').boundingBox())!
    expect(visualsBox.y).toBeGreaterThanOrEqual(whyBox.y + whyBox.height)
    expect(visualsBox.x).toBeLessThan(panelBox.x + 40)
    expect(doesBox.x).toBeLessThan(panelBox.x + 40)
    const figures = page.getByTestId('intent-visual')
    const first = (await figures.nth(0).boundingBox())!
    const second = (await figures.nth(1).boundingBox())!
    expect(Math.abs(first.y - second.y)).toBeLessThan(60)
  })
})

test.describe('Intent with more than 3 visuals', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('visuals', 4335, (bundlePath, review) => {
      for (const n of [2, 3]) {
        copyFileSync(join(bundlePath, 'assets/mr/screenshot.png'), join(bundlePath, `assets/mr/extra-${n}.png`))
        review.intent.visuals.push({ assetPath: `mr/extra-${n}.png`, caption: `Extra MR image ${n}.`, source: 'mr-text' })
      }
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('shows 3 images, MR text first, and puts the rest under More images', async ({ page }) => {
    await openReview(page, served.url)
    const visuals = page.getByTestId('intent-visuals')
    const more = visuals.getByTestId('more-visuals')
    await expect(visuals.getByTestId('intent-visual')).toHaveCount(4)
    await expect(visuals.getByTestId('intent-visual').nth(2).locator('figcaption')).toHaveText('Extra MR image 3.')
    await expect(more.locator('figure')).toHaveCount(1)
    await expect(more.locator('figure')).toBeHidden()
    await more.getByText(/More images/).click()
    await expect(more.locator('figure figcaption')).toHaveText('Changed snapshot of the login page.')
  })
})

test.describe('Intent without visuals', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('visuals', 4336, (_path, review) => {
      delete review.intent.visuals
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('shows no image area', async ({ page }) => {
    await openReview(page, served.url)
    await expect(page.getByText('Adds a limit on login attempts.')).toBeVisible()
    await expect(page.getByTestId('intent-visuals')).toHaveCount(0)
  })
})
