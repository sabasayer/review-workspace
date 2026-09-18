import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const enrichedBundle = join(root, 'fixtures/bundles/enriched')

let bundlePath: string
let handle: ReviewServerHandle

test.beforeAll(async () => {
  bundlePath = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-symbol-lookup-'))
  cpSync(enrichedBundle, bundlePath, { recursive: true })
  handle = await startReviewServer(bundlePath, { port: 4390 })
})

test.afterAll(async () => {
  await handle.close()
  rmSync(bundlePath, { recursive: true, force: true })
})

test.beforeEach(async ({ page }) => {
  await page.goto(`http://127.0.0.1:${handle.port}/`)
  await expect(page.getByText('src/auth/login.ts').first()).toBeVisible()
})

test('a plain click on a symbol does not open the occurrences popover', async ({ page }) => {
  await page.getByText('MAX_ATTEMPTS', { exact: true }).first().click()
  await expect(page.getByText(/occurrences? of/)).toHaveCount(0)
})

test('ctrl/cmd+click on a symbol lists its occurrences and jumps to the chosen one', async ({ page }) => {
  await page.getByText('MAX_ATTEMPTS', { exact: true }).first().click({ modifiers: ['ControlOrMeta'] })

  const popover = page.getByText('2 occurrences of “MAX_ATTEMPTS”').locator('..')
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('button', { name: /^src\/auth\/login\.ts:42/ })).toBeVisible()
  const definitionEntry = popover.getByRole('button', { name: /^src\/config\/rate-limit\.ts:1/ })
  await expect(definitionEntry).toBeVisible()

  await definitionEntry.click()

  await expect(popover).toBeHidden()
  await expect(page.locator('#file-src-config-rate-limit-ts').getByText('export const MAX_ATTEMPTS = 5')).toBeInViewport()
})

test('ctrl/cmd+clicking a symbol with no other occurrences opens nothing', async ({ page }) => {
  await page.getByText('RateLimitError', { exact: true }).first().click({ modifiers: ['ControlOrMeta'] })
  await expect(page.getByText(/occurrences? of/)).toHaveCount(0)
})
