import { describe, expect, it } from 'vitest'
import { answersUsedLabel, isLiveAnswering, liveAnswersLabel, staleBannerText } from './bundle-status.ts'
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
