import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('file-level diagnostics', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('image-pair', 4351, (_path, review) => {
      review.evidence = []
      review.annotations = [{ id: 'an-logo', target: { type: 'binary', path: 'assets/logo.png' }, summary: 'Logo changed.' }]
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('lists a changed image with no base and head asset on its file card', async ({ page }) => {
    await openReview(page, served.url)
    const card = page.locator('#file-assets-logo-png')
    await expect(card.getByTestId('file-diagnostics')).toContainText('Changed image has no base and head asset: assets/logo.png')
    await expect(page.getByTestId('bundle-diagnostics')).toHaveCount(0)
  })
})

test.describe('file-level diagnostics for a new image', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('image-pair', 4352, (bundlePath, review) => {
      review.evidence = []
      review.annotations = [{ id: 'an-logo', target: { type: 'binary', path: 'assets/logo.png' }, summary: 'Logo added.' }]
      writeFileSync(
        join(bundlePath, 'changes.diff'),
        'diff --git a/assets/logo.png b/assets/logo.png\nnew file mode 100644\nindex 0000000..2222222\nBinary files /dev/null and b/assets/logo.png differ\n',
      )
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('shows no missing-comparison diagnostic for an image with no base', async ({ page }) => {
    await openReview(page, served.url)
    const card = page.locator('#file-assets-logo-png')
    await expect(card).toBeVisible()
    await expect(card.getByTestId('file-diagnostics')).toHaveCount(0)
    await expect(page.getByTestId('bundle-diagnostics')).toHaveCount(0)
  })
})
