import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

const SUGGESTION = 'Show a clear message when the limit is reached.'

test.describe('suggestion buttons on a finding about the whole change', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4385)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('"Ask a question" opens the panel composer for the whole change', async ({ page }) => {
    await openReview(page, served.url)
    const finding = page.getByTestId('general-finding').first()
    await expect(finding.getByRole('button', { name: 'Raise as change-request' })).toBeVisible()
    await finding.getByRole('button', { name: 'Ask a question' }).click()

    const panel = page.getByTestId('question-panel')
    await expect(panel.getByTestId('composer-target')).toHaveValue('general')
    await expect(panel.getByPlaceholder("What's the reasoning here?")).toHaveValue(/^About "The issue asks for a lock-out message/)
    await panel.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(panel.getByTestId('question-thread').first().getByTestId('thread-target')).toHaveText('Whole change')
  })

  test('"Raise as change-request" starts with the suggestion in a tall box and raises a general Comment', async ({ page }) => {
    await openReview(page, served.url)
    const finding = page.getByTestId('general-finding').first()
    await finding.getByRole('button', { name: 'Raise as change-request' }).click()
    const box = finding.getByPlaceholder('What needs to change?')
    await expect(box).toHaveValue(SUGGESTION)
    expect((await box.boundingBox())!.height).toBeGreaterThan(100)

    await finding.getByRole('button', { name: 'Raise change request' }).click()

    const comments = page.getByTestId('general-comments')
    await expect(comments.getByTestId('general-comment').filter({ hasText: SUGGESTION })).toBeVisible()
    await expect(comments.getByTestId('general-comment').filter({ hasText: 'Change request' })).toBeVisible()

    await comments.getByTestId('general-comment').filter({ hasText: SUGGESTION }).click()
    const thread = page.getByTestId('question-panel').getByTestId('question-thread').filter({ hasText: SUGGESTION })
    await expect(thread.getByTestId('thread-target')).toHaveText('Whole change')
    await expect(thread).toHaveAttribute('data-state', 'none')

    const list = await (await fetch(`${served.url}questions`)).json()
    expect(list.find((c: { body: string }) => c.body === SUGGESTION)).toMatchObject({ kind: 'change-request', target: { type: 'general' } })
  })

  test('the Reviewer resolves a general change-request, and it is never marked stale', async ({ page }) => {
    await openReview(page, served.url)
    await page.getByTestId('general-comment').filter({ hasText: SUGGESTION }).click()
    const thread = page.getByTestId('question-panel').getByTestId('question-thread').filter({ hasText: SUGGESTION })
    await expect(thread.getByText(/touched|gone/i)).toHaveCount(0)
    await thread.getByRole('button', { name: 'Mark as fixed' }).click()
    await expect(thread.getByText('Fixed', { exact: true }).first()).toBeVisible()
  })
})

test.describe('suggestion buttons on a note', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4386)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('a note with a suggestion has both buttons, and "Ask a question" targets its line', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').first()
    await note.getByRole('button').first().click()
    await expect(note.getByTestId('note-suggestion')).toBeVisible()
    await expect(note.getByRole('button', { name: 'Raise as change-request' })).toBeVisible()
    await note.getByRole('button', { name: 'Ask a question' }).click()
    await expect(page.getByTestId('composer-target')).toHaveValue('line:src/auth/login.ts:head:42')
  })
})
