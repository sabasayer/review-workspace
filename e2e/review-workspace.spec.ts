import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const docScreenshots = join(root, 'docs/screenshots')

async function forceLightMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('nuxt-color-mode', 'light')
    document.documentElement.classList.remove('dark')
  })
}

async function waitForReviewLoaded(page: Page) {
  await expect(page.getByRole('heading', { name: 'Rate-limit login attempts' })).toBeVisible()
  await expect(page.getByText('src/auth/login.ts')).toBeVisible()
}

function bannerButtons(page: Page) {
  return page.getByRole('banner').getByRole('button')
}

test.describe('enriched bundle', () => {
  test.beforeEach(async ({ page }) => {
    await forceLightMode(page)
    await page.goto('/')
    await waitForReviewLoaded(page)
  })

  test('shows inline diff layout', async ({ page }) => {
    await expect(page).toHaveScreenshot('diff-review-inline.png', { fullPage: true })
    await page.screenshot({ path: join(docScreenshots, 'diff-review-inline.png'), fullPage: true })
  })

  test('shows side-by-side diff layout', async ({ page }) => {
    await bannerButtons(page).nth(4).click()
    await expect(page.getByText('if (attempts > MAX_ATTEMPTS)')).toBeVisible()
    await expect(page).toHaveScreenshot('diff-review-side-by-side.png', { fullPage: true })
    await page.screenshot({ path: join(docScreenshots, 'diff-review-side-by-side.png'), fullPage: true })
  })

  test('opens questions panel', async ({ page }) => {
    await bannerButtons(page).nth(2).click()
    const dialog = page.getByRole('dialog', { name: 'Questions' })
    await expect(dialog.getByText('What is the rate limit window?')).toBeVisible()
    await expect(dialog.getByText('The window is 60 seconds')).toBeVisible()
    await expect(dialog).toHaveScreenshot('questions-panel.png')
    await dialog.screenshot({ path: join(docScreenshots, 'questions-panel.png') })
  })

  test('opens MR details slideover', async ({ page }) => {
    await page.getByRole('button', { name: 'Details' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add login rate limiting' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveScreenshot('mr-details.png')
    await dialog.screenshot({ path: join(docScreenshots, 'mr-details.png') })
  })

  test('opens annotation note popover', async ({ page }) => {
    await page.getByRole('button', { name: /Note 1:/ }).click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })
    await expect(popover).toBeVisible()
    await expect(popover.getByRole('button', { name: '→ src/config/rate-limit.ts' })).toBeVisible()
    await expect(popover).toHaveScreenshot('annotation-note-popover.png')
    await popover.screenshot({ path: join(docScreenshots, 'annotation-note-popover.png') })
  })

  test('shows related code preview in annotation popover', async ({ page }) => {
    await page.getByRole('button', { name: /Note 1:/ }).click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })
    await popover.getByRole('button', { name: '→ src/config/rate-limit.ts' }).hover()
    await expect(popover.getByText('export const MAX_ATTEMPTS = 5')).toBeVisible()
    await expect(popover).toHaveScreenshot('annotation-related-code-preview.png')
    await popover.screenshot({ path: join(docScreenshots, 'annotation-related-code-preview.png') })
  })
})

test.describe('image-pair bundle', () => {
  let handle: ReviewServerHandle

  test.beforeAll(async () => {
    const bundlePath = join(root, 'fixtures/bundles/image-pair')
    handle = await startReviewServer(bundlePath, { port: 4319 })
  })

  test.afterAll(async () => {
    await handle.close()
  })

  test('renders image comparison evidence', async ({ page }) => {
    await forceLightMode(page)
    await page.goto(`http://127.0.0.1:${handle.port}/`)
    await expect(page.getByText('assets/logo.png')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Visual snapshot before/after')).toBeVisible()
    await expect(page).toHaveScreenshot('image-compare-side-by-side.png', { fullPage: true })
    await page.screenshot({ path: join(docScreenshots, 'image-compare-side-by-side.png'), fullPage: true })
  })
})
