import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const enrichedBundle = join(root, 'fixtures/bundles/enriched')
const writeToken = 'e2e-reviewer-progress-write-token'

async function forceLightMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('nuxt-color-mode', 'light')
    document.documentElement.classList.remove('dark')
  })
}

async function seedWriteToken(page: Page) {
  await page.addInitScript((token) => localStorage.setItem('review-workspace:write-token', token), writeToken)
}

async function waitForReviewLoaded(page: Page) {
  await expect(page.getByRole('heading', { name: 'Rate-limit login attempts' })).toBeVisible()
  await expect(page.getByText('src/auth/login.ts').first()).toBeVisible()
}

function bannerButtons(page: Page) {
  return page.getByRole('banner').getByRole('button')
}

// The enriched fixture's one Verification item (`vi-1`) targets its behavioral
// group ("bg-1"), which never resolves to an Annotation or file — a group id
// isn't a lookup key the renderer understands (see `buildVerificationByTargetId`
// in src/renderer/render.ts), so as shipped it never surfaces in Focus mode.
// Repointing it at the Annotation directly is the smallest edit that gives this
// suite a real Focus-mode entry (with an Annotation attached) to exercise.
function pointVerificationAtAnnotation(bundlePath: string) {
  const reviewPath = join(bundlePath, 'review.json')
  const document = JSON.parse(readFileSync(reviewPath, 'utf-8'))
  document.verification[0].targetIds = ['an-1']
  writeFileSync(reviewPath, JSON.stringify(document, null, 2))
}

let bundlePath: string
let handle: ReviewServerHandle

test.beforeAll(async () => {
  bundlePath = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-reviewer-progress-'))
  cpSync(enrichedBundle, bundlePath, { recursive: true })
  pointVerificationAtAnnotation(bundlePath)
  handle = await startReviewServer(bundlePath, { port: 4322, writeToken })
})

test.afterAll(async () => {
  await handle.close()
  rmSync(bundlePath, { recursive: true, force: true })
})

test.describe('without a write token', () => {
  test.beforeEach(async ({ page }) => {
    await forceLightMode(page)
    await page.goto(`http://127.0.0.1:${handle.port}/`)
    await waitForReviewLoaded(page)
  })

  test('asking a question from a note popover is blocked until a write token is set', async ({ page }) => {
    await page.getByRole('button', { name: /^Note 1\b/ }).click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })
    await popover.getByRole('button', { name: 'Ask a question' }).click()
    await popover.getByPlaceholder("What's the reasoning here?").fill('Why 5 attempts specifically?')

    const askButton = popover.getByRole('button', { name: 'Ask', exact: true })
    await expect(popover.getByText('Set your write token first (top right).')).toBeVisible()
    await expect(askButton).toBeDisabled()
  })
})

test.describe('reviewer progress checkboxes and note actions', () => {
  test.beforeEach(async ({ page }) => {
    await forceLightMode(page)
    await seedWriteToken(page)
    await page.goto(`http://127.0.0.1:${handle.port}/`)
    await waitForReviewLoaded(page)
  })

  test('file headers stick to the top of the scroll container', async ({ page }) => {
    const header = page.locator('article', { hasText: 'src/auth/login.ts' }).first().locator('header')
    await expect(header).toHaveCSS('position', 'sticky')
    await expect(header).toHaveCSS('top', '0px')
  })

  test('marking a file reviewed collapses it and marks it distinct, without affecting other files', async ({ page }) => {
    const reviewedFile = page.locator('#file-src-auth-login-ts')
    const otherFile = page.locator('#file-src-config-rate-limit-ts')
    const checkbox = reviewedFile.getByRole('checkbox', { name: 'Reviewed' })
    const diffCollapsedNotice = reviewedFile.getByText(/Diff collapsed/)

    // Negative: unreviewed by default, diff visible, no success styling.
    await expect(checkbox).not.toBeChecked()
    await expect(diffCollapsedNotice).toHaveCount(0)
    await expect(reviewedFile).not.toHaveClass(/border-success/)

    // Positive: checking it collapses the diff and marks the file.
    await checkbox.check()
    await expect(diffCollapsedNotice).toBeVisible()
    await expect(reviewedFile).toHaveClass(/border-success/)
    await expect(otherFile).not.toHaveClass(/border-success/)
    await expect(otherFile.getByRole('checkbox', { name: 'Reviewed' })).not.toBeChecked()

    // Persists across reload (state.json round trip via /state).
    await page.reload()
    await waitForReviewLoaded(page)
    const reloadedFile = page.locator('#file-src-auth-login-ts')
    await expect(reloadedFile.getByRole('checkbox', { name: 'Reviewed' })).toBeChecked()
    await expect(reloadedFile.getByText(/Diff collapsed/)).toBeVisible()

    // Negative: unchecking re-expands and clears the styling.
    await reloadedFile.getByRole('checkbox', { name: 'Reviewed' }).uncheck()
    await expect(reloadedFile.getByText(/Diff collapsed/)).toHaveCount(0)
    await expect(reloadedFile).not.toHaveClass(/border-success/)
  })

  test('marking a note resolved changes its styling and persists', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /^Note 1\b/ })
    await expect(trigger).toHaveClass(/text-warning/)

    await trigger.click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })
    const checkbox = popover.getByRole('checkbox', { name: 'Resolved' })

    // Negative: not resolved by default.
    await expect(checkbox).not.toBeChecked()

    // Positive: resolving flips the badge from warning to success.
    await checkbox.check()
    await expect(trigger).toHaveClass(/text-success/)
    await expect(trigger).not.toHaveClass(/text-warning/)

    await page.reload()
    await waitForReviewLoaded(page)
    const reloadedTrigger = page.getByRole('button', { name: /^Note 1\b/ })
    await expect(reloadedTrigger).toHaveClass(/text-success/)

    // Leave the note unresolved again so later tests in this file see the default state.
    await reloadedTrigger.click()
    await page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' }).getByRole('checkbox', { name: 'Resolved' }).uncheck()
  })

  test('asking a question from a note popover with a token raises it', async ({ page }) => {
    await page.getByRole('button', { name: /^Note 1\b/ }).click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })
    await popover.getByRole('button', { name: 'Ask a question' }).click()
    await popover.getByPlaceholder("What's the reasoning here?").fill('Why 5 attempts specifically?')
    await popover.getByRole('button', { name: 'Ask', exact: true }).click()

    await bannerButtons(page).nth(2).click()
    const dialog = page.getByRole('dialog', { name: 'Questions' })
    await expect(dialog.getByText('Why 5 attempts specifically?')).toBeVisible()
  })

  test('flagging a note as a change request pre-fills the summary and raises it; canceling raises nothing', async ({ page }) => {
    await page.getByRole('button', { name: /^Note 1\b/ }).click()
    const popover = page.locator('div.w-80').filter({ hasText: 'Rejects further attempts' })

    // Negative: canceling after flagging leaves no change-request behind.
    await popover.getByRole('button', { name: 'Flag as change-request' }).click()
    const textarea = popover.getByRole('textbox')
    await expect(textarea).toHaveValue(/Rejects further attempts/)
    await popover.getByRole('button', { name: 'Cancel' }).click()
    await expect(popover.getByRole('button', { name: 'Ask a question' })).toBeVisible()

    // Positive: submitting raises a change-request targeting the same line.
    await popover.getByRole('button', { name: 'Flag as change-request' }).click()
    await popover.getByRole('button', { name: 'Raise change request' }).click()
    await page.reload()
    await waitForReviewLoaded(page)
    const lineTarget = page.locator('#file-src-auth-login-ts')
    await expect(lineTarget.getByRole('button', { name: /^Change request/ })).toBeVisible()
  })

  test('focus mode shows the note inline, previews its diff without leaving, and lets you resolve/ask', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click()
    await expect(page.getByText(/^\d+ \/ \d+ — ordered by risk$/)).toBeVisible()
    await expect(page.getByText('Rejects further attempts')).toBeVisible()

    // Positive: the diff preview toggle shows the actual target line inline.
    const showDiff = page.getByRole('button', { name: '▸ preview diff' })
    await expect(showDiff).toBeVisible()
    await showDiff.click()
    await expect(page.getByText('if (attempts > MAX_ATTEMPTS)')).toBeVisible()
    await page.getByRole('button', { name: '▾ close diff preview' }).click()
    await expect(page.getByText('if (attempts > MAX_ATTEMPTS)')).toHaveCount(0)

    // Resolve the note and ask a question, both without leaving focus mode.
    await page.getByRole('checkbox', { name: 'Resolved' }).check()
    await expect(page.getByRole('checkbox', { name: 'Resolved' })).toBeChecked()

    await page.getByRole('button', { name: 'Ask a question' }).click()
    await page.getByPlaceholder("What's the reasoning here?").fill('Should this window be configurable per-tenant?')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Ask a question' })).toBeVisible()
  })

  test('exiting focus mode returns to the normal file list', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus' }).click()
    await expect(page.getByText(/^\d+ \/ \d+ — ordered by risk$/)).toBeVisible()

    // Negative: exiting goes back to the normal file list, not a dead end.
    await page.getByRole('button', { name: 'Esc — exit focus mode' }).click()
    await expect(page.getByText(/^\d+ \/ \d+ — ordered by risk$/)).toHaveCount(0)
    await expect(page.locator('#file-src-auth-login-ts')).toBeVisible()
  })
})
