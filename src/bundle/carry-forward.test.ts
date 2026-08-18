import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

  it('evaluates each carried comment and produces the correct claimed status', () => {
    carryForwardChain(round2)
    const byId = new Map(computeCarriedResolutions(round2).map((c) => [c.comment.id, c.resolution.status]))
    expect(byId.get('cr-retry')).toBe('claimed-addressed')
    expect(byId.get('cr-logging')).toBe('claimed-not-addressed')
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
  it('attaches a claimed Resolution only to carried, still-open change-requests', () => {
    carryForwardChain(round2)
    const comments = listComments(round2)
    const retry = comments.find((c) => c.id === 'cr-retry')!
    expect(retry.resolution?.status).toBe('claimed-addressed')
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
})
