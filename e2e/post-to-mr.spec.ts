import { test, expect } from '@playwright/test'
import { openReview, readClipboard, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('Post to MR', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4340)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('lets the Reviewer edit a Comment and copies a prompt for the skill', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openReview(page, served.url)
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    await page.getByTestId('post-to-mr').click()

    const text = page.getByTestId('post-to-mr-text')
    await expect(text).toHaveValue('What is the rate limit window?')
    await text.fill('Which window does the limiter use?')
    await page.getByRole('button', { name: 'Copy prompt' }).click()
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible()
    expect(await readClipboard(page)).toBe(
      'Post this comment to the MR inline: src/auth/login.ts:42 Which window does the limiter use?',
    )
  })
})
