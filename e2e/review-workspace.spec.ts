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
  await expect(page.getByText('src/auth/login.ts').first()).toBeVisible()
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

  test('shows a Summary panel that jumps to a highlighted file on click', async ({ page }) => {
    const panel = page.getByRole('region', { name: 'Summary' })
    await expect(panel.getByText('Adds a sliding-window rate limiter')).toBeVisible()
    await expect(panel).toHaveScreenshot('summary-panel.png')
    await panel.screenshot({ path: join(docScreenshots, 'summary-panel.png') })

    await panel.getByRole('button', { name: '→ src/auth/login.ts' }).first().click()
    await expect(page.locator('#file-src-auth-login-ts')).toBeInViewport()
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
    // The Summary panel pushes this annotation further down the page than the default
    // viewport height, and Reka UI's floating popover re-flips/re-shifts on every
    // scroll tick — racing Playwright's own auto-scroll-into-view for the screenshot
    // and never settling. A taller viewport gives the popover room without flipping.
    await page.setViewportSize({ width: 1280, height: 1400 })
    const trigger = page.getByRole('button', { name: /Note 1:/ })
    await trigger.scrollIntoViewIfNeeded()
    await trigger.click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })
    await popover.getByRole('button', { name: '→ src/config/rate-limit.ts' }).hover()
    await expect(popover.getByText('export const MAX_ATTEMPTS = 5')).toBeVisible()
    // A fraction-of-a-pixel scroll offset shifts subpixel text rendering here — tolerate
    // that anti-aliasing noise, content and structure are already asserted above.
    await expect(popover).toHaveScreenshot('annotation-related-code-preview.png', { maxDiffPixelRatio: 0.02 })
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
