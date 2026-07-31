import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { watchBundle, type BundleWatcherHandle } from './watch-bundle.ts'

let dir: string
let watcher: BundleWatcherHandle

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'review-workspace-watch-'))
  writeFileSync(join(dir, 'review.json'), '{}')
})

afterEach(() => {
  watcher?.stop()
  rmSync(dir, { recursive: true, force: true })
})

function waitForChange(handle: BundleWatcherHandle, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for change event')), timeoutMs)
    handle.emitter.once('change', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

describe('watchBundle', () => {
  it('emits change when review.json is rewritten', async () => {
    watcher = watchBundle(dir, 20)
    const changed = waitForChange(watcher)
    await new Promise((r) => setTimeout(r, 30))
    writeFileSync(join(dir, 'review.json'), '{"schemaVersion":1}')
    await expect(changed).resolves.toBeUndefined()
  })
})
