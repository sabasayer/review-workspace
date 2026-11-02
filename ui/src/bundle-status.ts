import type { LiveHeadStatus, WatcherRead } from './types.ts'

export function staleBannerText(status: LiveHeadStatus | null): string | null {
  return status?.stale ? `The MR has new commits since round ${status.round}` : null
}

const IDLE_HEARTBEAT_LIMIT_MS = 30_000
const BUSY_HEARTBEAT_LIMIT_MS = 5 * 60_000

export function isWatcherStale(read: WatcherRead | null, now: Date = new Date()): boolean {
  if (read?.status !== 'ok' || !read.watcher.enabled || !read.watcher.updatedAt) return false
  const limit = read.watcher.current === null ? IDLE_HEARTBEAT_LIMIT_MS : BUSY_HEARTBEAT_LIMIT_MS
  return now.getTime() - Date.parse(read.watcher.updatedAt) > limit
}

export function isLiveAnswering(read: WatcherRead | null, now: Date = new Date()): boolean {
  return read?.status === 'ok' && read.watcher.enabled && read.watcher.used < read.watcher.cap && !isWatcherStale(read, now)
}

export function liveAnswersLabel(read: WatcherRead | null, now: Date = new Date()): string {
  if (isWatcherStale(read, now)) return 'Live answers: watcher stopped'
  return `Live answers: ${isLiveAnswering(read, now) ? 'on' : 'off'}`
}

export function answersUsedLabel(read: WatcherRead | null): string | null {
  return read?.status === 'ok' && read.watcher.enabled ? `Answers used: ${read.watcher.used} of ${read.watcher.cap}` : null
}
