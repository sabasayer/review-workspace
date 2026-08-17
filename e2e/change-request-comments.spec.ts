import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const docScreenshots = join(root, 'docs/screenshots')
const enrichedBundle = join(root, 'fixtures/bundles/enriched')
const writeToken = 'e2e-change-request-write-token'

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

// Writes land in questions.jsonl on disk, so this runs against a throwaway copy of
// the fixture rather than the shared bundle the rest of the e2e suite reads from —
// same isolation `create-server.test.ts` uses for the same reason.
test.describe('change-request comments', () => {
  let bundlePath: string
  let handle: ReviewServerHandle

  test.beforeAll(async () => {
    bundlePath = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-change-request-'))
    cpSync(enrichedBundle, bundlePath, { recursive: true })
    handle = await startReviewServer(bundlePath, { port: 4320, writeToken })
  })

  test.afterAll(async () => {
    await handle.close()
    rmSync(bundlePath, { recursive: true, force: true })
  })

  test('raises a change-request comment, sees it rendered distinct from a question, then resolves it and it collapses without disappearing', async ({
    page,
  }) => {
    await forceLightMode(page)
    await page.addInitScript((token) => {
      localStorage.setItem('review-workspace:write-token', token)
    }, writeToken)
    await page.goto(`http://127.0.0.1:${handle.port}/`)
    await waitForReviewLoaded(page)

    // Reveal and open the file-level comment composer on src/auth/login.ts.
    const fileHeader = page.locator('article', { hasText: 'src/auth/login.ts' }).first()
    const fileCommentsRow = fileHeader.locator('div', { hasText: 'Questions on this file:' }).last()
    const composerTrigger = fileCommentsRow.getByRole('button', { name: 'Comment on this' })
    await composerTrigger.hover()
    await composerTrigger.click()

    await page.getByRole('button', { name: 'Change request' }).click()
    await page.getByPlaceholder('What needs to change?').fill('Please extract this into a helper function')
    await page.getByRole('button', { name: 'Raise change request' }).click()

    const badge = fileHeader.getByRole('button', { name: /^Change request/ })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('!')

    // Visually distinct from a Question badge (blue "?" vs red "!").
    const questionBadge = fileHeader.getByRole('button', { name: /^Question:/ }).first()
    await expect(questionBadge).toHaveText('?')
    await expect(badge).not.toHaveClass(/text-info/)
    await expect(questionBadge).not.toHaveClass(/text-error/)

    // A fresh load avoids racing the composer popover's own closing transition —
    // the Comment is already persisted server-side by this point, so the reloaded
    // page shows exactly the same state without a screenshot mid-animation.
    await page.reload()
    await waitForReviewLoaded(page)
    await expect(badge).toBeVisible()
    await page.screenshot({ path: join(docScreenshots, 'change-request-open.png'), fullPage: true })

    await badge.click()
    await page.getByRole('button', { name: 'Mark resolved' }).click()

    await expect(badge).toHaveText('✓')
    await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0)

    // Still present in the log, not removed — it just renders collapsed by default.
    await bannerButtons(page).nth(2).click()
    const dialog = page.getByRole('dialog', { name: 'Questions' })
    await expect(dialog.getByText('Change request')).toBeVisible()
    await expect(dialog.getByText('Resolved', { exact: true })).toBeVisible()

    const showButton = dialog.getByRole('button', { name: 'Show' })
    await expect(showButton).toBeVisible()
    // Collapsed rows render as plain (non-interactive) text, not the clickable
    // jump-to-target control expanded rows get — that's what "collapsed" means here.
    await expect(dialog.getByRole('button', { name: 'Please extract this into a helper function' })).toHaveCount(0)

    await dialog.screenshot({ path: join(docScreenshots, 'change-request-resolved-collapsed.png') })

    await showButton.click()
    await expect(dialog.getByRole('button', { name: 'Hide' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Please extract this into a helper function' })).toBeVisible()
  })
})
