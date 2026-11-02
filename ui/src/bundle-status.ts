import type { LiveHeadStatus, WatcherRead } from './types.ts'

export function staleBannerText(status: LiveHeadStatus | null): string | null {
  return status?.stale ? `The MR has new commits since round ${status.round}` : null
}

export function isLiveAnswering(read: WatcherRead | null): boolean {
  return read?.status === 'ok' && read.watcher.enabled && read.watcher.used < read.watcher.cap
}

export function liveAnswersLabel(read: WatcherRead | null): string {
  return `Live answers: ${isLiveAnswering(read) ? 'on' : 'off'}`
}

export function answersUsedLabel(read: WatcherRead | null): string | null {
  return read?.status === 'ok' && read.watcher.enabled ? `Answers used: ${read.watcher.used} of ${read.watcher.cap}` : null
}
