import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('Before you read the code', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('general-target', 4332)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('shows general findings above the diff and in the Start here list', async ({ page }) => {
    await openReview(page, served.url)
    const section = page.getByTestId('before-you-read')
    await expect(section.getByRole('heading', { name: 'Before you read the code' })).toBeVisible()

    const finding = section.getByTestId('general-finding')
    await expect(finding).toContainText('The issue asks for a lock-out message')
    await expect(finding.getByTestId('note-verdict')).toHaveText('Missing')
    await expect(finding.getByTestId('note-suggestion')).toContainText('Show a clear message when the limit is reached.')

    const startHere = section.getByRole('list').last()
    await expect(startHere).toContainText('The issue asks for a lock-out message.')

    const sectionBox = (await section.boundingBox())!
    const firstFileBox = (await page.locator('article[id]').first().boundingBox())!
    expect(sectionBox.y).toBeLessThan(firstFileBox.y)
  })

  test('counts the general finding in open gaps', async ({ page }) => {
    await openReview(page, served.url)
    await expect(page.getByTestId('open-gaps')).toHaveText('1')
  })

  test('jumps from Start here to the general finding', async ({ page }) => {
    await openReview(page, served.url)
    await page.getByTestId('before-you-read').getByRole('button', { name: /The issue asks for a lock-out message/ }).click()
    await expect(page.getByTestId('general-findings')).toBeInViewport()
  })
})

test.describe('Before you read the code with an enriched bundle', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4333)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('holds the Intent, general findings and Start here, and counts open gaps from the engine', async ({ page }) => {
    await openReview(page, served.url)
    const section = page.getByTestId('before-you-read')
    await expect(section.getByTestId('general-finding')).toHaveCount(1)
    await expect(section.getByText('Start here')).toBeVisible()
    const gaps = await page.getByTestId('open-gaps').innerText()
    const view = await (await page.request.get(`${served.url}api/view`)).json()
    expect(Number(gaps)).toBe(view.openGaps)
  })
})
