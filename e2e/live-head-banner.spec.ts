import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { openReview, readClipboard, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('live head banner', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4338)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('warns about new commits and copies the next-round prompt', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openReview(page, served.url)
    const banner = page.getByTestId('stale-banner')
    await expect(banner).toContainText('The MR has new commits since round 1')
    await banner.getByRole('button', { name: 'Copy next-round prompt' }).click()
    await expect(banner.getByRole('button', { name: 'Copied!' })).toBeVisible()
    const prompt = await readClipboard(page)
    expect(prompt).toContain('Invoke the /review-workspace skill on this bundle ')
    expect(prompt).toContain(served.bundlePath)
    expect(prompt).toContain('the MR has new commits (live head fff3333). Start the next round.')
  })

  test('shows no banner when the live head matches the bundle', async ({ page }) => {
    const view = await (await page.request.get(`${served.url}api/view`)).json()
    writeFileSync(
      join(served.bundlePath, 'live-head.json'),
      JSON.stringify({ head: view.comparison.head, checkedAt: '2026-10-27T09:00:00.000Z' }),
    )
    await openReview(page, served.url)
    await expect(page.getByTestId('stale-banner')).toHaveCount(0)
  })
})
