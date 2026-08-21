import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readQuestions, resolveComment } from '../questions/questions-log.ts'
import {
  carryForwardChain,
  collectCarriedReviewContent,
  collectCommentHistory,
  computeCarriedResolutions,
  listComments,
  readChain,
} from './carry-forward.ts'

const round1Fixture = fileURLToPath(new URL('../../fixtures/bundles/chained-mr-100/', import.meta.url))
const round2Fixture = fileURLToPath(new URL('../../fixtures/bundles/chained-mr-100-r2/', import.meta.url))

let workParent: string
let round1: string
let round2: string

beforeEach(() => {
  workParent = mkdtempSync(join(tmpdir(), 'review-workspace-carry-forward-'))
  round1 = join(workParent, 'chained-mr-100')
  round2 = join(workParent, 'chained-mr-100-r2')
  cpSync(round1Fixture, round1, { recursive: true })
  cpSync(round2Fixture, round2, { recursive: true })
})

afterEach(() => {
  rmSync(workParent, { recursive: true, force: true })
})

describe('readChain', () => {
  it('returns undefined for a round-1 bundle with no chain.json', () => {
    expect(readChain(round1)).toBeUndefined()
  })

  it('reads chain.json for a round-N>1 bundle', () => {
    expect(readChain(round2)).toEqual({
      mrKey: 'example/carry!100',
      round: 2,
      previousBundle: '../chained-mr-100',
      previousHead: 'head1111',
    })
  })
})

describe('carryForwardChain', () => {
  it('no-ops for a round-1 bundle (no chain.json)', () => {
    carryForwardChain(round1)
    expect(existsSync(join(round1, 'questions.jsonl'))).toBe(true)
    expect(readQuestions(round1)).toHaveLength(3)
  })

  it('copies every still-open change-request from the previous round into this round\'s own log', () => {
    carryForwardChain(round2)
    const ids = readQuestions(round2).map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['cr-retry', 'cr-logging', 'cr-legacy']))
  })

  it('preserves the original id, body, and createdAt when carrying a comment forward', () => {
    carryForwardChain(round2)
    const carried = readQuestions(round2).find((c) => c.id === 'cr-retry')!
    const original = readQuestions(round1).find((c) => c.id === 'cr-retry')!
    expect(carried.body).toBe(original.body)
    expect(carried.createdAt).toBe(original.createdAt)
    expect(carried.target).toEqual(original.target)
  })

  it('does not carry forward a comment already resolved in the previous round', () => {
    resolveComment(round1, 'cr-logging')
    carryForwardChain(round2)
    expect(readQuestions(round2).map((c) => c.id)).not.toContain('cr-logging')
  })

  it('is idempotent — calling it twice does not duplicate log entries', () => {
    carryForwardChain(round2)
    const after1 = readFileSync(join(round2, 'questions.jsonl'), 'utf-8')
    carryForwardChain(round2)
    const after2 = readFileSync(join(round2, 'questions.jsonl'), 'utf-8')
    expect(after2).toBe(after1)
  })

  it('lets a carried comment be resolved directly from the new round', () => {
    carryForwardChain(round2)
    const result = resolveComment(round2, 'cr-retry')
    expect(result.outcome).toBe('resolved')
  })
})

describe('computeCarriedResolutions', () => {
  it('returns an empty array for a round-1 bundle', () => {
    expect(computeCarriedResolutions(round1)).toEqual([])
  })

  it('evaluates each carried comment and produces the correct mechanical touched status', () => {
    carryForwardChain(round2)
    const byId = new Map(computeCarriedResolutions(round2).map((c) => [c.comment.id, c.resolution.status]))
    // cr-retry's round-2 fix (fixtures/bundles/chained-mr-100-r2/changes.diff) adds three
    // unconditional retries with NO backoff at all — the requested change was never made.
    // `target-touched` only means the hunk containing the Target changed; it is a purely
    // mechanical hunk-fingerprint signal (resolution.ts), never a judgment that the
    // underlying concern was actually resolved.
    expect(byId.get('cr-retry')).toBe('target-touched')
    expect(byId.get('cr-logging')).toBe('target-untouched')
    expect(byId.get('cr-legacy')).toBe('target-gone')
  })
})

describe('collectCommentHistory', () => {
  it('surfaces a comment resolved in the previous round even though it was never carried forward', () => {
    resolveComment(round1, 'cr-logging')
    carryForwardChain(round2)
    const history = collectCommentHistory(round2)
    const resolved = history.find((c) => c.id === 'cr-logging')!
    expect(resolved.resolved).toBe(true)
    expect(resolved.originRound).toBe(1)
  })

  it('tags a comment carried forward and still open with its true origin round, not the round it now also lives in', () => {
    carryForwardChain(round2)
    const history = collectCommentHistory(round2)
    expect(history.find((c) => c.id === 'cr-retry')!.originRound).toBe(1)
  })

  it('never drops a comment across rounds', () => {
    resolveComment(round1, 'cr-logging')
    carryForwardChain(round2)
    const ids = collectCommentHistory(round2).map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['cr-retry', 'cr-logging', 'cr-legacy']))
  })
})

describe('listComments', () => {
  it('attaches a mechanical Resolution only to carried, still-open change-requests', () => {
    carryForwardChain(round2)
    const comments = listComments(round2)
    const retry = comments.find((c) => c.id === 'cr-retry')!
    expect(retry.resolution?.status).toBe('target-touched')
  })

  it('leaves resolution undefined for a comment resolved in an earlier round', () => {
    resolveComment(round1, 'cr-logging')
    carryForwardChain(round2)
    const resolved = listComments(round2).find((c) => c.id === 'cr-logging')!
    expect(resolved.resolution).toBeUndefined()
  })
})

describe('collectCarriedReviewContent', () => {
  it('carries forward a Behavioral Group and Annotation whose file the incremental patch does not touch', () => {
    const ownDocument = JSON.parse(readFileSync(join(round2, 'review.json'), 'utf-8'))
    const carried = collectCarriedReviewContent(round2, ownDocument)
    expect(carried.behavioralGroups.map((g) => g.id)).toContain('bg-logging')
    expect(carried.annotations.map((a) => a.id)).toContain('an-logging')
  })

  it('does not carry forward an Annotation whose file the incremental patch touches', () => {
    const ownDocument = JSON.parse(readFileSync(join(round2, 'review.json'), 'utf-8'))
    const carried = collectCarriedReviewContent(round2, ownDocument)
    expect(carried.annotations.map((a) => a.id)).not.toContain('an-retry')
  })

  it('returns nothing for a round-1 bundle', () => {
    const ownDocument = JSON.parse(readFileSync(join(round1, 'review.json'), 'utf-8'))
    expect(collectCarriedReviewContent(round1, ownDocument)).toEqual({ behavioralGroups: [], annotations: [] })
  })

  it('reflects an ancestor bundle republished after it was already read, rather than serving stale content', () => {
    const ownDocument = JSON.parse(readFileSync(join(round2, 'review.json'), 'utf-8'))

    // First read: as an ancestor of round2's chain, round1's review.json gets read here.
    const before = collectCarriedReviewContent(round2, ownDocument)
    expect(before.behavioralGroups.find((g) => g.id === 'bg-logging')?.title).toBe('Structured logging')

    // Simulate the "Improve" workflow republishing round1's review.json in place —
    // same base/head, new content — the way a long-running server watching round2
    // would never see if round1's content were cached for the lifetime of the process.
    const round1Document = JSON.parse(readFileSync(join(round1, 'review.json'), 'utf-8'))
    round1Document.behavioralGroups[0].title = 'Structured logging (revised)'
    writeFileSync(join(round1, 'review.json'), JSON.stringify(round1Document))

    // A fresh top-level call — no caches passed in, so none can have survived from the
    // read above — must see the republished content.
    const after = collectCarriedReviewContent(round2, ownDocument)
    expect(after.behavioralGroups.find((g) => g.id === 'bg-logging')?.title).toBe('Structured logging (revised)')
  })
})
