import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const writeToken = 'e2e-quick-fixes-write-token'
const markdownAnswer = 'The window is **60 seconds**.\n\n```ts\nconst windowMs = 60_000\n```'

async function openReview(page: Page, port: number) {
  await page.addInitScript((token) => {
    localStorage.setItem('nuxt-color-mode', 'light')
    localStorage.setItem('review-workspace:write-token', token)
  }, writeToken)
  await page.goto(`http://127.0.0.1:${port}/`)
  await expect(page.getByRole('heading', { name: 'Rate-limit login attempts' })).toBeVisible()
}

test.describe('phase 1 quick fixes', () => {
  let bundlePath: string
  let handle: ReviewServerHandle

  test.beforeAll(async () => {
    bundlePath = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-quick-fixes-'))
    cpSync(join(root, 'fixtures/bundles/enriched'), bundlePath, { recursive: true })
    const reviewPath = join(bundlePath, 'review.json')
    const review = JSON.parse(readFileSync(reviewPath, 'utf-8'))
    review.answers[0].body = markdownAnswer
    review.intent = {
      does: 'Adds a limiter.',
      why: 'Stops brute force.',
      doesNot: ['No UI change.'],
      sources: ['MR text', 'Linear ENG-9'],
      weakDescription: 'no reason given.',
    }
    writeFileSync(reviewPath, JSON.stringify(review, null, 2))
    handle = await startReviewServer(bundlePath, { port: 4323, writeToken })
  })

  test.afterAll(async () => {
    await handle.close()
    rmSync(bundlePath, { recursive: true, force: true })
  })

  test('renders an answer as markdown with a code block', async ({ page }) => {
    await openReview(page, handle.port)
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    const answer = page.locator('.markdown-body', { hasText: '60 seconds' })
    await expect(answer.locator('strong')).toHaveText('60 seconds')
    await expect(answer.locator('pre code')).toContainText('const windowMs = 60_000')
  })

  test('keeps the file header with its position in view while scrolling the file', async ({ page }) => {
    await openReview(page, handle.port)
    const article = page.locator('article[id]', { hasText: 'src/auth/login.ts' }).first()
    const header = article.locator('header')
    await expect(header).toContainText(/file \d+ of \d+/)
    await page.setViewportSize({ width: 1280, height: 300 })
    const main = page.locator('main')
    const mainTop = (await main.boundingBox())!.y
    const headerTopInPage = (await header.boundingBox())!.y
    await main.evaluate((el, by) => el.scrollBy(0, by), headerTopInPage - mainTop + 40)
    const mainPadding = 16
    await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(mainTop + mainPadding, 0)
  })

  test('shows an Intent panel with its sources and a weak-description flag', async ({ page }) => {
    await openReview(page, handle.port)
    const panel = page.getByTestId('intent-panel')
    await expect(panel).toContainText('Adds a limiter.')
    await expect(panel).toContainText('What it does not do')
    await expect(panel).toContainText('Sources: MR text, Linear ENG-9')
    await expect(panel).toContainText('The MR text is weak: no reason given.')
  })

  test('deletes an open question without a replacement', async ({ page }) => {
    await openReview(page, handle.port)
    const fileHeader = page.locator('article[id]', { hasText: 'src/auth/login.ts' }).first()
    const composerTrigger = fileHeader.locator('div', { hasText: 'Questions on this file:' }).last().getByRole('button', { name: 'Comment on this' })
    await composerTrigger.hover()
    await composerTrigger.click()
    await page.getByPlaceholder(`What's the reasoning here?`).fill('Delete me')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Question: Delete me' }).click()
    await page.getByTestId('question-thread').filter({ hasText: 'Delete me' }).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Question: Delete me' })).toHaveCount(0)
    const list = await (await fetch(`http://127.0.0.1:${handle.port}/questions`)).json()
    expect(list.find((q: { body: string }) => q.body === 'Delete me').status).toBe('withdrawn')
    expect(list.filter((q: { body: string }) => q.body === 'Delete me')).toHaveLength(1)
  })
})

test.describe('bundle diagnostics banner', () => {
  let handle: ReviewServerHandle

  test.beforeAll(async () => {
    handle = await startReviewServer(join(root, 'fixtures/bundles/diagnostics'), { port: 4324 })
  })

  test.afterAll(async () => {
    await handle.close()
  })

  test('lists the text of each bundle-level diagnostic', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${handle.port}/`)
    const banner = page.getByTestId('bundle-diagnostics')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Unresolved file target: file not found in patch')
    await expect(banner).toContainText('Missing asset: missing.png')
  })

  test('says which changed image has no base and head asset', async ({ page }) => {
    const imageBundle = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-image-diagnostic-'))
    cpSync(join(root, 'fixtures/bundles/image-pair'), imageBundle, { recursive: true })
    const reviewPath = join(imageBundle, 'review.json')
    const review = JSON.parse(readFileSync(reviewPath, 'utf-8'))
    review.evidence = []
    review.annotations = [{ id: 'an-shot', target: { type: 'binary', path: 'shots/page.png' }, summary: 'Page changed.' }]
    writeFileSync(reviewPath, JSON.stringify(review))
    const imageHandle = await startReviewServer(imageBundle, { port: 4325 })
    try {
      await page.goto(`http://127.0.0.1:${imageHandle.port}/`)
      await expect(page.getByTestId('bundle-diagnostics')).toContainText('Changed image has no base and head asset: shots/page.png')
    } finally {
      await imageHandle.close()
      rmSync(imageBundle, { recursive: true, force: true })
    }
  })
})
