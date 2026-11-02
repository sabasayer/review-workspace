import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

export const root = fileURLToPath(new URL('..', import.meta.url))
export const writeToken = 'e2e-support-write-token'

export interface ServedBundle {
  bundlePath: string
  handle: ReviewServerHandle
  url: string
  stop: () => Promise<void>
}

export type ReviewJson = Record<string, any>

export async function serveFixtureCopy(
  fixture: string,
  port: number,
  prepare: (bundlePath: string, review: ReviewJson) => void = () => {},
  repoPath?: string,
): Promise<ServedBundle> {
  const bundlePath = mkdtempSync(join(tmpdir(), `review-workspace-e2e-${fixture}-`))
  cpSync(join(root, 'fixtures/bundles', fixture), bundlePath, { recursive: true })
  const reviewPath = join(bundlePath, 'review.json')
  const review: ReviewJson = JSON.parse(readFileSync(reviewPath, 'utf-8'))
  prepare(bundlePath, review)
  writeFileSync(reviewPath, JSON.stringify(review, null, 2))
  const handle = await startReviewServer(bundlePath, { port, writeToken, repoPath })
  return {
    bundlePath,
    handle,
    url: `http://127.0.0.1:${handle.port}/`,
    stop: async () => {
      await handle.close()
      rmSync(bundlePath, { recursive: true, force: true })
    },
  }
}

export async function openReview(page: Page, url: string) {
  await page.addInitScript((token) => {
    localStorage.setItem('nuxt-color-mode', 'light')
    localStorage.setItem('review-workspace:write-token', token)
  }, writeToken)
  await page.goto(url)
  await expect(page.locator('article[id]').first()).toBeVisible()
}

export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText())
}
