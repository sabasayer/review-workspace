import { writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

const login = { type: 'file', path: 'src/auth/login.ts' }

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolve(port))
    })
  })
}

const raised = (id: string, body: string, createdAt: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: 'raised', id, createdAt, body, target: login, ...extra }) + '\n'

test.describe('Question drawer tabs', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    const port = await freePort()
    console.log(`question-drawer-tabs port: ${port}`)
    served = await serveFixtureCopy('enriched', port, (bundlePath, review) => {
      review.answers = []
      writeFileSync(
        join(bundlePath, 'questions.jsonl'),
        raised('q-open', 'Is the window per user?', '2026-02-01T00:00:01.000Z') +
          raised('cr-open', 'Please rename this helper.', '2026-02-01T00:00:02.000Z', { kind: 'change-request' }),
      )
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('keeps Questions and Change-requests apart, and the nav badge counts Questions only', async ({ page }) => {
    await openReview(page, served.url)
    const navBadge = page.getByTestId('panel-badge')
    await expect(navBadge).toContainText('1 open')
    await expect(navBadge).toHaveAttribute('data-tone', 'open')

    await page.getByRole('button', { name: 'Question panel' }).click()
    const panel = page.getByTestId('question-panel')
    const questionsTab = panel.getByRole('tab', { name: /^Questions/ })
    const changeTab = panel.getByRole('tab', { name: /^Change-requests/ })
    const threads = panel.getByTestId('question-thread')

    await expect(questionsTab).toHaveAttribute('aria-selected', 'true')
    await expect(questionsTab).toContainText('1')
    await expect(changeTab).toContainText('1')
    await expect(threads).toHaveCount(1)
    await expect(threads.first()).toContainText('Is the window per user?')
    await expect(panel.getByText('Please rename this helper.')).toHaveCount(0)

    await changeTab.click()
    await expect(changeTab).toHaveAttribute('aria-selected', 'true')
    await expect(threads).toHaveCount(1)
    const change = threads.first()
    await expect(change).toContainText('Please rename this helper.')
    await expect(change.getByText('Waiting for the author', { exact: true })).toBeVisible()
    await expect(panel.getByText('Is the window per user?')).toHaveCount(0)
    await expect(navBadge).toContainText('1 open')

    await change.getByRole('button', { name: 'Mark as fixed' }).click()
    await expect(change.getByText('Fixed', { exact: true }).first()).toBeVisible()
    await change.getByRole('button', { name: 'Show', exact: true }).click()
    await expect(change).toContainText('Marked fixed')
    await change.getByRole('button', { name: 'Hide', exact: true }).click()
    await expect(change.getByRole('button', { name: 'Mark as fixed' })).toHaveCount(0)
    await expect(changeTab).toHaveAccessibleName('Change-requests')
    await expect(navBadge).toContainText('1 open')

    await questionsTab.click()
    await expect(threads).toHaveCount(1)
    await expect(threads.first()).toContainText('Is the window per user?')

    const composer = panel.getByTestId('question-composer')
    await composer.getByRole('button', { name: 'Change request' }).click()
    await expect(changeTab).toHaveAttribute('aria-selected', 'true')
    await composer.getByRole('button', { name: 'Question', exact: true }).click()
    await expect(questionsTab).toHaveAttribute('aria-selected', 'true')
  })

  test('moves between the tabs with the arrow keys', async ({ page }) => {
    await openReview(page, served.url)
    await page.getByRole('button', { name: 'Question panel' }).click()
    const panel = page.getByTestId('question-panel')
    await expect(panel.getByRole('tablist', { name: 'Comment kind' })).toBeVisible()
    const questionsTab = panel.getByRole('tab', { name: /^Questions/ })
    const changeTab = panel.getByRole('tab', { name: /^Change-requests/ })
    await questionsTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(changeTab).toHaveAttribute('aria-selected', 'true')
    await expect(changeTab).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(questionsTab).toHaveAttribute('aria-selected', 'true')
    await expect(questionsTab).toBeFocused()
    await expect(panel.getByRole('tabpanel')).toBeVisible()
  })

  test('keeps the chosen tab after the drawer closes and opens again', async ({ page }) => {
    await openReview(page, served.url)
    await page.getByRole('button', { name: 'Question panel' }).click()
    const panel = page.getByTestId('question-panel')
    await panel.getByRole('tab', { name: /^Change-requests/ }).click()
    await page.getByRole('button', { name: 'Close the Question panel' }).click()
    await page.getByRole('button', { name: 'Question panel' }).click()
    await expect(page.getByTestId('question-panel').getByRole('tab', { name: /^Change-requests/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('shows the empty text of a tab with nothing in it', async ({ page }) => {
    const empty = await serveFixtureCopy('enriched', await freePort(), (bundlePath, review) => {
      review.answers = []
      writeFileSync(join(bundlePath, 'questions.jsonl'), raised('q-only', 'Only a Question.', '2026-02-01T00:00:01.000Z'))
    })
    try {
      await openReview(page, empty.url)
      await page.getByRole('button', { name: 'Question panel' }).click()
      const panel = page.getByTestId('question-panel')
      await panel.getByRole('tab', { name: /^Change-requests/ }).click()
      await expect(panel.getByText('No change-requests raised yet.')).toBeVisible()
      await expect(panel.getByRole('tab', { name: /^Change-requests/ })).toHaveAccessibleName('Change-requests')
    } finally {
      await empty.stop()
    }
  })
})
