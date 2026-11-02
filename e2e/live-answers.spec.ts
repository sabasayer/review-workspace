import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { openReview, readClipboard, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('live answers state', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4339, (_path, review) => {
      review.answers = []
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('with no watcher, says off and lets the Reviewer send the Question to the agent', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openReview(page, served.url)
    await expect(page.getByTestId('live-answers')).toHaveText('Live answers: off')

    await page.getByRole('button', { name: /^Question:/ }).first().click()
    const waiting = page.getByTestId('waiting-for-agent')
    await expect(waiting).toContainText('Waiting for the agent.')
    await waiting.getByRole('button', { name: 'Send to agent' }).click()
    await expect(waiting.getByRole('button', { name: 'Copied!' })).toBeVisible()
    const prompt = await readClipboard(page)
    expect(prompt).toContain('Invoke the /review-workspace skill on this bundle ')
    expect(prompt).toContain('What is the rate limit window?')
  })

  test('with the watcher on, says on and how many answers are used', async ({ page }) => {
    writeFileSync(join(served.bundlePath, 'watcher.json'), JSON.stringify({ enabled: true, cap: 20, used: 3 }))
    await openReview(page, served.url)
    await expect(page.getByTestId('live-answers')).toHaveText('Live answers: on · Answers used: 3 of 20')
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    await expect(page.getByTestId('thread-state')).toHaveText('Waiting')
    await expect(page.getByTestId('waiting-for-agent')).toHaveCount(0)
  })

  test('falls back to Send to agent when the cap is reached', async ({ page }) => {
    writeFileSync(join(served.bundlePath, 'watcher.json'), JSON.stringify({ enabled: true, cap: 20, used: 20 }))
    await openReview(page, served.url)
    await expect(page.getByTestId('live-answers')).toHaveText('Live answers: off · Answers used: 20 of 20')
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    await expect(page.getByTestId('waiting-for-agent')).toBeVisible()
  })
})

test.describe('change-request in a note thread', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4353, (bundlePath, review) => {
      review.answers = []
      appendFileSync(
        join(bundlePath, 'questions.jsonl'),
        JSON.stringify({
          type: 'raised',
          id: 'cr-1',
          kind: 'change-request',
          createdAt: '2026-01-02T00:00:00.000Z',
          body: 'Please move the limit into config.',
          target: { type: 'line', path: 'src/auth/login.ts', side: 'head', line: 42, expectedText: '  if (attempts > MAX_ATTEMPTS) {' },
        }) + '\n',
      )
      writeFileSync(join(bundlePath, 'watcher.json'), JSON.stringify({ enabled: true, cap: 20, used: 0 }))
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('says "Not answered yet." under the Question only, never under the change-request', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').filter({ hasText: 'Rejects further attempts' })
    await note.getByRole('button').first().click()
    await expect(note.getByText('What is the rate limit window?')).toBeVisible()
    await expect(note.getByText('Please move the limit into config.')).toBeVisible()
    await expect(note.getByText('Not answered yet.')).toHaveCount(1)
    const changeRequestRow = note.locator('li', { hasText: 'Please move the limit into config.' })
    await expect(changeRequestRow.getByText('Not answered yet.')).toHaveCount(0)
    await expect(changeRequestRow.getByTestId('waiting-for-agent')).toHaveCount(0)
  })
})
