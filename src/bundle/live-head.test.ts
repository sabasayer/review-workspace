import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildLiveHeadStatus, bundleStaleness, readLiveHead } from './live-head.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'live-head-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeLiveHead(content: string) {
  writeFileSync(join(dir, 'live-head.json'), content)
}

describe('readLiveHead', () => {
  it('reports absent when the file does not exist', () => {
    expect(readLiveHead(dir)).toEqual({ status: 'absent' })
  })

  it('reads a valid file', () => {
    writeLiveHead(JSON.stringify({ head: 'fff3333', checkedAt: '2026-10-27T09:00:00.000Z' }))
    expect(readLiveHead(dir)).toEqual({ status: 'ok', liveHead: { head: 'fff3333', checkedAt: '2026-10-27T09:00:00.000Z' } })
  })

  it('reports invalid JSON with the reason', () => {
    writeLiveHead('{nope')
    expect(readLiveHead(dir)).toMatchObject({ status: 'invalid', message: expect.stringContaining('not valid JSON') })
  })

  it.each([
    ['a missing head', { checkedAt: '2026-10-27T09:00:00.000Z' }],
    ['an empty head', { head: '', checkedAt: '2026-10-27T09:00:00.000Z' }],
    ['a missing checkedAt', { head: 'fff3333' }],
    ['a checkedAt that is not a date', { head: 'fff3333', checkedAt: 'yesterday' }],
  ])('reports invalid for %s', (_name, content) => {
    writeLiveHead(JSON.stringify(content))
    expect(readLiveHead(dir)).toMatchObject({ status: 'invalid' })
  })

  it('reports invalid when the file is not an object', () => {
    writeLiveHead('[]')
    expect(readLiveHead(dir)).toMatchObject({ status: 'invalid' })
  })
})

describe('bundleStaleness', () => {
  const liveHead = { head: 'fff3333', checkedAt: '2026-10-27T09:00:00.000Z' }

  it('is stale when the live head differs from the Comparison head', () => {
    expect(bundleStaleness('def2222', liveHead, 2)).toEqual({ stale: true, round: 2 })
  })

  it('is not stale when the heads match', () => {
    expect(bundleStaleness('fff3333', liveHead, 1)).toEqual({ stale: false, round: 1 })
  })

  it('is not stale when there is no live head', () => {
    expect(bundleStaleness('def2222', undefined, 3)).toEqual({ stale: false, round: 3 })
  })
})

describe('buildLiveHeadStatus', () => {
  const liveHead = { head: 'fff3333', checkedAt: '2026-10-27T09:00:00.000Z' }

  it('carries the live head and the staleness for an ok read', () => {
    expect(buildLiveHeadStatus({ status: 'ok', liveHead }, 'def2222', 2)).toEqual({
      status: 'ok',
      liveHead,
      recordedHead: 'def2222',
      stale: true,
      round: 2,
    })
  })

  it('is not stale and has no live head when the file is absent', () => {
    expect(buildLiveHeadStatus({ status: 'absent' }, 'def2222', 1)).toEqual({
      status: 'absent',
      recordedHead: 'def2222',
      stale: false,
      round: 1,
    })
  })

  it('carries the message for an invalid file', () => {
    expect(buildLiveHeadStatus({ status: 'invalid', message: 'bad' }, 'def2222', 1)).toEqual({
      status: 'invalid',
      message: 'bad',
      recordedHead: 'def2222',
      stale: false,
      round: 1,
    })
  })
})
