import { EventEmitter } from 'node:events'
import { statSync } from 'node:fs'
import { join } from 'node:path'

export interface BundleWatcherHandle {
  emitter: EventEmitter
  stop: () => void
}

/**
 * Polls review.json's mtime rather than using fs.watch — fs.watch's rename/change
 * semantics are notoriously inconsistent across platforms for atomic-rename-based
 * writes, and a bundle is a local, low-frequency-write directory where a short poll
 * interval is indistinguishable from a native watch in practice.
 */
export function watchBundle(bundlePath: string, intervalMs = 100): BundleWatcherHandle {
  const emitter = new EventEmitter()
  const reviewPath = join(bundlePath, 'review.json')
  let lastMtime = statOrNull(reviewPath)

  const timer = setInterval(() => {
    const mtime = statOrNull(reviewPath)
    if (mtime !== lastMtime) {
      lastMtime = mtime
      emitter.emit('change')
    }
  }, intervalMs)
  timer.unref()

  return { emitter, stop: () => clearInterval(timer) }
}

function statOrNull(path: string): number | null {
  try {
    return statSync(path).mtimeMs
  } catch {
    return null
  }
}
