import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { backupPathFor } from '../src/bundle/backup.ts'
import { startReviewServer, type ReviewServerHandle } from '../src/server/create-server.ts'
import { openReview, root, writeToken } from './support.ts'

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolve(port))
    })
  })
}

test.describe('bundle backup', () => {
  let bundlePath: string
  let backupRoot: string
  let handle: ReviewServerHandle
  let url: string

  test.beforeAll(async () => {
    bundlePath = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-backup-bundle-'))
    backupRoot = mkdtempSync(join(tmpdir(), 'review-workspace-e2e-backup-root-'))
    cpSync(join(root, 'fixtures/bundles/enriched'), bundlePath, { recursive: true })
    const port = await freePort()
    console.log(`bundle-backup e2e port: ${port}`)
    handle = await startReviewServer(bundlePath, { port, writeToken, backupRoot })
    url = `http://127.0.0.1:${handle.port}/`
  })

  test.afterAll(async () => {
    await handle.close()
    rmSync(bundlePath, { recursive: true, force: true })
    rmSync(backupRoot, { recursive: true, force: true })
  })

  test('shows the backup path when the served bundle folder is deleted', async ({ page }) => {
    await openReview(page, url)

    rmSync(bundlePath, { recursive: true, force: true })

    const failure = page.getByTestId('load-error')
    await expect(failure).toBeVisible({ timeout: 20_000 })
    await expect(failure).toContainText(backupPathFor(bundlePath, backupRoot))
  })
})
