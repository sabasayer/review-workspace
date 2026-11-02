import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { openReview, serveFixtureCopy, type ReviewJson, type ServedBundle } from './support.ts'

const findingText =
  'The message belongs in `rate-limit.ts`. The page title comes from `nuxt.config.ts`. Ignore `ghost.ts`, `login()` and `MAX_ATTEMPTS`.'

function addFileNames(_bundlePath: string, review: ReviewJson) {
  review.annotations.find((a: ReviewJson) => a.id === 'an-2').summary = findingText
}

const finding = (page: Page) => page.getByTestId('general-finding').first()
const ref = (page: Page, name: string) => finding(page).locator(`code[data-file-ref="${name}"]`)

test.describe('preview and jump, with --repo', () => {
  let served: ServedBundle
  let repoDir: string

  test.beforeAll(async () => {
    repoDir = mkdtempSync(join(tmpdir(), 'rw-e2e-repo-'))
    mkdirSync(join(repoDir, 'src'))
    writeFileSync(join(repoDir, 'nuxt.config.ts'), Array.from({ length: 60 }, (_, i) => `// config line ${i + 1}`).join('\n'))
    served = await serveFixtureCopy('enriched', 4361, addFileNames, repoDir)
  })

  test.afterAll(async () => {
    await served.stop()
    rmSync(repoDir, { recursive: true, force: true })
  })

  test('hover on a changed file shows a diff glimpse', async ({ page }) => {
    await openReview(page, served.url)
    await ref(page, 'rate-limit.ts').hover()
    const preview = page.getByTestId('file-preview')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('src/config/rate-limit.ts')
    await expect(preview).toContainText('export const MAX_ATTEMPTS = 5')
    await expect(preview).toContainText('Ctrl+click to open')
    await page.mouse.move(5, 5)
    await expect(preview).toBeHidden()
  })

  test('keyboard focus opens the preview and Escape closes it', async ({ page }) => {
    await openReview(page, served.url)
    await ref(page, 'rate-limit.ts').focus()
    await expect(page.getByTestId('file-preview')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('file-preview')).toBeHidden()
  })

  test('hover on a file outside the diff shows the top 40 lines from the repo', async ({ page }) => {
    await openReview(page, served.url)
    await ref(page, 'nuxt.config.ts').hover()
    const preview = page.getByTestId('file-preview')
    await expect(preview).toContainText('// config line 1')
    await expect(preview).toContainText('// config line 40')
    await expect(preview).not.toContainText('// config line 41')
    await expect(preview).toContainText('Not in the diff')
  })

  test('shows nothing for a file that cannot be read', async ({ page }) => {
    await openReview(page, served.url)
    await ref(page, 'ghost.ts').hover()
    await page.waitForTimeout(700)
    await expect(page.getByTestId('file-preview')).toHaveCount(0)
  })

  test('Ctrl+click jumps to the file in the diff and highlights it; a plain click does nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await openReview(page, served.url)
    const target = page.locator('#file-src-config-rate-limit-ts')
    await ref(page, 'rate-limit.ts').click()
    await page.waitForTimeout(500)
    await expect(target).not.toBeInViewport()
    await ref(page, 'rate-limit.ts').click({ modifiers: ['ControlOrMeta'] })
    await expect(target).toBeInViewport()
    await expect(target).toHaveClass(/jump-flash/)
    await expect(target).not.toHaveClass(/jump-flash/, { timeout: 4000 })
  })

  test('Ctrl+click on a file outside the diff does nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await openReview(page, served.url)
    const before = await page.evaluate(() => document.querySelector('main')!.scrollTop)
    await ref(page, 'nuxt.config.ts').click({ modifiers: ['ControlOrMeta'] })
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => document.querySelector('main')!.scrollTop)).toBe(before)
  })

  test('only names that look like files become links', async ({ page }) => {
    await openReview(page, served.url)
    await expect(finding(page).locator('code[data-file-ref]')).toHaveCount(3)
  })

  test('the jump icon on a note scrolls to its line in the diff', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').filter({ hasText: 'Rejects further attempts' })
    await note.getByRole('button', { name: 'Jump to this code in the diff' }).click()
    await expect(page.locator('#line-src-auth-login-ts-0-2')).toHaveClass(/jump-flash/)
  })
})

test.describe('preview and jump, without --repo', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4362, addFileNames)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('a changed file still previews; a file outside the diff shows nothing', async ({ page }) => {
    await openReview(page, served.url)
    await ref(page, 'rate-limit.ts').hover()
    await expect(page.getByTestId('file-preview')).toContainText('export const MAX_ATTEMPTS = 5')
    await page.mouse.move(5, 5)
    await ref(page, 'nuxt.config.ts').hover()
    await page.waitForTimeout(700)
    await expect(page.getByTestId('file-preview')).toHaveCount(0)
  })
})
