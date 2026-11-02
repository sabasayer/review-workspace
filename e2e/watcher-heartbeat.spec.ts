import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

const heartbeatPort = 50280

test.describe('watcher heartbeat', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', heartbeatPort, (_path, review) => {
      review.answers = []
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  const writeWatcher = (updatedAt: string, current: string | null = null) =>
    writeFileSync(join(served.bundlePath, 'watcher.json'), JSON.stringify({ enabled: true, cap: 20, used: 3, current, updatedAt }))

  test('a fresh heartbeat shows Live answers: on', async ({ page }) => {
    writeWatcher(new Date().toISOString())
    await openReview(page, served.url)
    await expect(page.getByTestId('live-answers')).toHaveText('Live answers: on · Answers used: 3 of 20')
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    await expect(page.getByTestId('waiting-for-agent')).toHaveCount(0)
  })

  test('an old heartbeat shows watcher stopped and offers Send to agent', async ({ page }) => {
    writeWatcher(new Date(Date.now() - 10 * 60_000).toISOString())
    await openReview(page, served.url)
    await expect(page.getByTestId('live-answers')).toContainText('Live answers: watcher stopped')
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    const waiting = page.getByTestId('waiting-for-agent')
    await expect(waiting).toContainText('Waiting for the agent.')
    await expect(waiting.getByRole('button', { name: 'Send to agent' })).toBeVisible()
  })

  test('an old heartbeat with a current Question shows waiting, not answering', async ({ page }) => {
    writeWatcher(new Date(Date.now() - 10 * 60_000).toISOString(), 'q-1')
    await openReview(page, served.url)
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    const waiting = page.getByTestId('waiting-for-agent')
    await expect(waiting).toContainText('Waiting for the agent.')
    await expect(waiting.getByRole('button', { name: 'Send to agent' })).toBeVisible()
  })
})
