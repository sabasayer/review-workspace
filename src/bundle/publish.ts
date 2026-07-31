import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateBundle, type BlockingReason } from './validate-bundle.ts'
import { DEFAULT_LIMITS, type BundleLimits } from '../security/limits.ts'

export interface PublishResult {
  ok: boolean
  blockingReason?: BlockingReason | 'missing-next'
  message?: string
}

/**
 * Validates a staged `review.next.json` and, only on success, atomically
 * replaces `review.json` with it. On any failure `review.json` is left
 * byte-for-byte untouched.
 */
export function publishBundle(bundlePath: string, limits: BundleLimits = DEFAULT_LIMITS): PublishResult {
  const nextPath = join(bundlePath, 'review.next.json')
  if (!existsSync(nextPath)) {
    return { ok: false, blockingReason: 'missing-next', message: 'review.next.json not found' }
  }

  const result = validateBundle(bundlePath, limits, 'review.next.json')
  if (!result.valid) {
    return { ok: false, blockingReason: result.blockingReason, message: result.message }
  }

  const reviewPath = join(bundlePath, 'review.json')
  const tmpPath = join(bundlePath, `.review.json.tmp-${process.pid}-${Date.now()}`)
  writeFileSync(tmpPath, readFileSync(nextPath, 'utf-8'))
  renameSync(tmpPath, reviewPath)
  return { ok: true }
}
