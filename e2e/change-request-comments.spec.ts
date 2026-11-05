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

// Writes land in questions.jsonl on disk, so this runs against a throwaway copy of
// the fixture rather than the shared bundle the rest of the e2e suite reads from —
// same isolation `create-server.test.ts` uses for the same reason.
test.describe('change-request comments', () => {
  let bundlePath: string
  let handle: ReviewServerHandle

  test.beforeAll(async () => {
    bundlePath = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-change-request-'))
    cpSync(enrichedBundle, bundlePath, { recursive: true })
    handle = await startReviewServer(bundlePath, { port: 4387, writeToken })
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
    const fileHeader = page.locator('article[id]', { hasText: 'src/auth/login.ts' }).first()
    const fileCommentsRow = fileHeader.locator('div', { hasText: 'Questions on this file:' }).last()
    const composerTrigger = fileCommentsRow.getByRole('button', { name: 'Comment on this' })
    await composerTrigger.hover()
    await composerTrigger.click()
    const panel = page.getByTestId('question-panel')
    await expect(panel.getByTestId('composer-target')).toHaveValue('file:src/auth/login.ts')
    await panel.getByRole('button', { name: 'Change request' }).click()
    await panel.getByPlaceholder('What needs to change?').fill('Please extract this into a helper function')
    await panel.getByRole('button', { name: 'Raise change request' }).click()
    await panel.getByRole('tab', { name: /^Change-requests/ }).click()
    await expect(panel.getByTestId('question-thread').filter({ hasText: 'Please extract this into a helper function' })).toBeVisible()

    const badge = fileHeader.getByRole('button', { name: /^Change request/ })
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText('!')

    // Visually distinct from a Question badge (blue "?" vs red "!").
    const questionBadge = fileHeader.getByRole('button', { name: /^Question:/ }).first()
    await expect(questionBadge).toHaveText('?')
    await expect(badge).not.toHaveClass(/text-info/)
    await expect(questionBadge).not.toHaveClass(/text-error/)

    // A fresh load starts from the persisted state, with the panel closed.
    await page.reload()
    await waitForReviewLoaded(page)
    await expect(badge).toBeVisible()
    await page.screenshot({ path: join(docScreenshots, 'change-request-open.png'), fullPage: true })

    await badge.click()
    await expect(panel.getByRole('tab', { name: /^Change-requests/ })).toHaveAttribute('aria-selected', 'true')
    const thread = panel.getByTestId('question-thread').filter({ hasText: 'Please extract this into a helper function' })
    await expect(thread).toHaveAttribute('data-state', 'none')
    await thread.getByRole('button', { name: 'Mark as fixed' }).click()

    await expect(badge).toHaveText('✓')
    await expect(thread.getByText('Fixed', { exact: true }).first()).toBeVisible()

    // A resolved change-request collapses by default and never disappears.
    const showButton = thread.getByRole('button', { name: 'Show', exact: true })
    await expect(showButton).toBeVisible()
    const expandedBody = thread.locator('p.leading-relaxed')
    await expect(expandedBody).toHaveCount(0)
    await page.screenshot({ path: join(docScreenshots, 'change-request-inline-resolved-collapsed.png') })
    await panel.screenshot({ path: join(docScreenshots, 'change-request-resolved-collapsed.png') })

    await showButton.click()
    await expect(thread.getByRole('button', { name: 'Hide' })).toBeVisible()
    await expect(expandedBody).toContainText('Please extract this into a helper function')
    await expect(thread.getByRole('button', { name: 'Mark as fixed' })).toHaveCount(0)
  })
})
