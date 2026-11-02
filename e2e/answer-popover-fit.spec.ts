import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

const LAST_LINE = 'This is the very last line of the long Answer.'
const longAnswer = [
  ...Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}: the limit counts failed attempts in a sliding window.`),
  LAST_LINE,
].join('\n\n')

test.describe('long Answer in the Question panel', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4357, (_path, review) => {
      review.answers[0].body = longAnswer
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('fits the window, scrolls inside itself and never cuts off the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await openReview(page, served.url)
    await page.getByRole('button', { name: /^Question:/ }).first().click()

    const panel = page.getByTestId('question-panel')
    const popover = panel.getByTestId('thread-list')
    await expect(popover).toBeVisible()
    const box = (await panel.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(500)
    await expect(popover.getByText('What is the rate limit window?')).toBeInViewport()
    await expect(panel.getByTestId('question-composer')).toBeInViewport()
    const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)
    expect(pageScrolls).toBe(false)

    const scrolls = await popover.evaluate((el) => el.scrollHeight > el.clientHeight)
    expect(scrolls).toBe(true)
    await popover.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await expect(popover.getByText(LAST_LINE)).toBeInViewport()
  })
})
