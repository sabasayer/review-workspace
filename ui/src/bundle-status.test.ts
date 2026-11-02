import { describe, expect, it } from 'vitest'
import { answersUsedLabel, isLiveAnswering, isWatcherStale, liveAnswersLabel, staleBannerText } from './bundle-status.ts'
import type { LiveHeadStatus, WatcherRead } from './types.ts'

const on: WatcherRead = { status: 'ok', watcher: { enabled: true, cap: 20, used: 3, current: null } }
const atCap: WatcherRead = { status: 'ok', watcher: { enabled: true, cap: 20, used: 20, current: null } }
const off: WatcherRead = { status: 'ok', watcher: { enabled: false, cap: 20, used: 0, current: null } }

describe('staleBannerText', () => {
  const base: LiveHeadStatus = { status: 'ok', recordedHead: 'a', stale: true, round: 2 }

  it('names the round when the bundle is stale', () => {
    expect(staleBannerText(base)).toBe('The MR has new commits since round 2')
  })

  it('stays hidden when not stale or not loaded', () => {
    expect(staleBannerText({ ...base, stale: false })).toBeNull()
    expect(staleBannerText(null)).toBeNull()
  })
})

describe('live answers', () => {
  it('is on only when enabled and under the cap', () => {
    expect(isLiveAnswering(on)).toBe(true)
    expect(isLiveAnswering(atCap)).toBe(false)
    expect(isLiveAnswering(off)).toBe(false)
    expect(isLiveAnswering({ status: 'absent' })).toBe(false)
    expect(isLiveAnswering(null)).toBe(false)
  })

  it('labels the state', () => {
    expect(liveAnswersLabel(on)).toBe('Live answers: on')
    expect(liveAnswersLabel(atCap)).toBe('Live answers: off')
    expect(liveAnswersLabel({ status: 'absent' })).toBe('Live answers: off')
  })

  it('shows the answer count only when the watcher is enabled', () => {
    expect(answersUsedLabel(on)).toBe('Answers used: 3 of 20')
    expect(answersUsedLabel(atCap)).toBe('Answers used: 20 of 20')
    expect(answersUsedLabel(off)).toBeNull()
    expect(answersUsedLabel({ status: 'invalid', message: 'x' })).toBeNull()
  })
})

describe('watcher heartbeat', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const watcher = (overrides: Partial<Extract<WatcherRead, { status: 'ok' }>['watcher']>): WatcherRead => ({
    status: 'ok',
    watcher: { enabled: true, cap: 20, used: 3, current: null, ...overrides },
  })

  it('is fresh within 30 seconds when idle', () => {
    expect(isWatcherStale(watcher({ updatedAt: ago(10_000) }), now)).toBe(false)
    expect(isWatcherStale(watcher({ updatedAt: ago(30_000) }), now)).toBe(false)
  })

  it('is stale after 30 seconds when idle', () => {
    expect(isWatcherStale(watcher({ updatedAt: ago(31_000) }), now)).toBe(true)
  })

  it('allows 5 minutes while a Question is being answered', () => {
    expect(isWatcherStale(watcher({ current: 'q-1', updatedAt: ago(4 * 60_000) }), now)).toBe(false)
    expect(isWatcherStale(watcher({ current: 'q-1', updatedAt: ago(5 * 60_000 + 1_000) }), now)).toBe(true)
  })

  it('is never stale without updatedAt', () => {
    expect(isWatcherStale(watcher({}), now)).toBe(false)
  })

  it('is never stale when disabled, absent, invalid or not loaded', () => {
    expect(isWatcherStale(watcher({ enabled: false, updatedAt: ago(3_600_000) }), now)).toBe(false)
    expect(isWatcherStale({ status: 'absent' }, now)).toBe(false)
    expect(isWatcherStale({ status: 'invalid', message: 'x' }, now)).toBe(false)
    expect(isWatcherStale(null, now)).toBe(false)
  })

  it('stops live answering when stale, and says the watcher stopped', () => {
    const stale = watcher({ updatedAt: ago(60_000) })
    expect(isLiveAnswering(stale, now)).toBe(false)
    expect(liveAnswersLabel(stale, now)).toBe('Live answers: watcher stopped')
  })

  it('keeps on and off labels when the heartbeat is fresh or missing', () => {
    expect(liveAnswersLabel(watcher({ updatedAt: ago(5_000) }), now)).toBe('Live answers: on')
    expect(liveAnswersLabel(watcher({}), now)).toBe('Live answers: on')
    expect(liveAnswersLabel(watcher({ enabled: false, updatedAt: ago(60_000) }), now)).toBe('Live answers: off')
  })

  it('leaves the answers used label unchanged when stale', () => {
    expect(answersUsedLabel(watcher({ updatedAt: ago(60_000) }))).toBe('Answers used: 3 of 20')
  })
})
