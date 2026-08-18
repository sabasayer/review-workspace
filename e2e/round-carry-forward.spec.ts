import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const docScreenshots = join(root, 'docs/screenshots')
const round1Fixture = join(root, 'fixtures/bundles/chained-mr-100')
const round2Fixture = join(root, 'fixtures/bundles/chained-mr-100-r2')
const writeToken = 'e2e-round-carry-forward-write-token'

async function forceLightMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('nuxt-color-mode', 'light')
    document.documentElement.classList.remove('dark')
  })
}

// Writes (resolving a carried comment) land on disk, so this runs against a throwaway
// copy of both round bundles rather than the shared fixture the rest of the e2e suite
// reads from — same isolation `change-request-comments.spec.ts` uses for the same reason.
test.describe('round-N carry-forward', () => {
  let workParent: string
  let round2Path: string
  let handle: ReviewServerHandle

  test.beforeAll(async () => {
    workParent = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-round-'))
    cpSync(round1Fixture, join(workParent, 'chained-mr-100'), { recursive: true })
    round2Path = join(workParent, 'chained-mr-100-r2')
    cpSync(round2Fixture, round2Path, { recursive: true })
    handle = await startReviewServer(round2Path, { port: 4321, writeToken })
  })

  test.afterAll(async () => {
    await handle.close()
    rmSync(workParent, { recursive: true, force: true })
  })

  test('shows carried-forward comments with their mechanical touched status, a distinct target-gone case, and a carried-forward Behavioral Group', async ({
    page,
  }) => {
    await forceLightMode(page)
    await page.addInitScript((token) => {
      localStorage.setItem('review-workspace:write-token', token)
    }, writeToken)
    await page.goto(`http://127.0.0.1:${handle.port}/`)

    // The "Structured logging" group and its Annotation belong only to round 1's
    // review.json — round 2 never redeclares them, so seeing them here proves the
    // render layer actually carried them forward (not just the round's own document).
    await expect(page.getByRole('heading', { name: 'Structured logging' })).toBeVisible()

    await page.getByRole('banner').getByRole('button').nth(2).click()
    const dialog = page.getByRole('dialog', { name: 'Questions' })
    await expect(dialog).toBeVisible()

    await expect(dialog.getByText('Please add a backoff between retries.')).toBeVisible()
    await expect(dialog.getByText('Please redact PII before logging the message.')).toBeVisible()
    await expect(dialog.getByText('Please delete this dead legacy helper instead of calling it.')).toBeVisible()

    await expect(dialog.getByText('Touched by new commits', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Not touched by new commits')).toBeVisible()
    // Surfaced distinctly, not silently dropped, when its original Target no longer resolves.
    await expect(dialog.getByText('Target gone')).toBeVisible()

    // Every carried comment originated in round 1.
    await expect(dialog.getByText('Round 1')).toHaveCount(3)

    await page.screenshot({ path: join(docScreenshots, 'round-carry-forward-comments.png') })

    // Selecting a carried comment closes the slideover and jumps straight to its
    // Target in this round's own diff — proving it's actionable here, not read-only
    // history copied in for display only.
    const retryRow = dialog.locator('li', { hasText: 'Please add a backoff between retries.' })
    await retryRow.locator('button').first().click()
    await expect(dialog).toBeHidden()

    const retryFile = page.locator('article', { hasText: 'src/retry.ts' }).first()
    const retryBadge = retryFile.getByRole('button', { name: /^Change request/ })
    await expect(retryBadge).toBeVisible()
    await retryBadge.click()

    await page.getByRole('button', { name: 'Mark resolved' }).click()
    await expect(retryBadge).toHaveText('✓')

    // Resolved comments persist and stay visible (collapsed) in this round's view too.
    await page.getByRole('banner').getByRole('button').nth(2).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Please add a backoff between retries.')).toBeVisible()
    await expect(dialog.getByText('Resolved', { exact: true }).first()).toBeVisible()
  })
})
