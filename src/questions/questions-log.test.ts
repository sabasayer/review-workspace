import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { raiseQuestion, readQuestions, resolveComment, withdrawAndReplaceQuestion } from './questions-log.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'review-workspace-questions-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('questions log', () => {
  it('raises a Question and appends it to questions.jsonl', () => {
    const q = raiseQuestion(dir, 'Why is this rate limit set to 5?')
    expect(q.status).toBe('open')
    const lines = readFileSync(join(dir, 'questions.jsonl'), 'utf-8').trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0])).toMatchObject({ type: 'raised', id: q.id })
  })

  it('lists all raised Questions as open', () => {
    raiseQuestion(dir, 'first')
    raiseQuestion(dir, 'second')
    expect(readQuestions(dir).map((q) => q.status)).toEqual(['open', 'open'])
  })

  it('withdraws a Question and raises its replacement without mutating the original record', () => {
    const original = raiseQuestion(dir, 'badly phrased question')
    const before = readFileSync(join(dir, 'questions.jsonl'), 'utf-8')

    const { replacement } = withdrawAndReplaceQuestion(dir, original.id, 'better phrased question')

    const after = readFileSync(join(dir, 'questions.jsonl'), 'utf-8')
    expect(after.startsWith(before)).toBe(true) // original bytes untouched, only appended to

    const questions = readQuestions(dir)
    const originalNow = questions.find((q) => q.id === original.id)!
    const replacementNow = questions.find((q) => q.id === replacement.id)!
    expect(originalNow.status).toBe('withdrawn')
    expect(originalNow.supersededBy).toBe(replacement.id)
    expect(replacementNow.status).toBe('open')
    expect(replacementNow.body).toBe('better phrased question')
  })

  it('returns an empty list when questions.jsonl does not exist', () => {
    expect(readQuestions(dir)).toEqual([])
  })

  it('raises a Comment tagged kind: question', () => {
    const q = raiseQuestion(dir, 'Why is this rate limit set to 5?')
    expect(q.kind).toBe('question')
  })

  it('treats a pre-existing log entry with no kind field as a question (backward compat)', () => {
    const legacyEntry = { type: 'raised', id: 'legacy-1', createdAt: new Date().toISOString(), body: 'a Question raised before kind existed' }
    writeFileSync(join(dir, 'questions.jsonl'), JSON.stringify(legacyEntry) + '\n')

    const [comment] = readQuestions(dir)
    expect(comment.kind).toBe('question')
    expect(comment.status).toBe('open')
  })

  it('raises a Comment tagged kind: change-request on any Target type', () => {
    const fileTarget = { type: 'file' as const, path: 'src/auth/login.ts' }
    const c = raiseQuestion(dir, 'Please add a test for the retry path', fileTarget, 'change-request')
    expect(c.kind).toBe('change-request')
    expect(c.target).toEqual(fileTarget)
    expect(c.resolved).toBe(false)
  })

  it('raises an unresolved Comment by default', () => {
    const q = raiseQuestion(dir, 'first')
    expect(q.resolved).toBe(false)
    expect(q.resolvedAt).toBeUndefined()
  })

  it('resolves a change-request Comment, setting resolved and resolvedAt', () => {
    const c = raiseQuestion(dir, 'Please add a test', undefined, 'change-request')
    const result = resolveComment(dir, c.id)
    expect(result.outcome).toBe('resolved')
    expect(result.outcome === 'resolved' && result.comment.resolved).toBe(true)
    expect(result.outcome === 'resolved' && result.comment.resolvedAt).toBeTruthy()

    const [reread] = readQuestions(dir)
    expect(reread.resolved).toBe(true)
    expect(result.outcome === 'resolved' && reread.resolvedAt === result.comment.resolvedAt).toBe(true)
  })

  it('rejects resolving a question Comment, appending nothing to the log', () => {
    const q = raiseQuestion(dir, 'Why 5?')
    const before = readFileSync(join(dir, 'questions.jsonl'), 'utf-8')

    const result = resolveComment(dir, q.id)

    expect(result.outcome).toBe('not-resolvable')
    expect(result.outcome === 'not-resolvable' && result.comment.kind).toBe('question')
    expect(readFileSync(join(dir, 'questions.jsonl'), 'utf-8')).toBe(before)
    expect(readQuestions(dir).find((c) => c.id === q.id)?.resolved).toBe(false)
  })

  it('rejects resolving an already-resolved change-request, appending nothing to the log', () => {
    const c = raiseQuestion(dir, 'Please fix', undefined, 'change-request')
    resolveComment(dir, c.id)
    const before = readFileSync(join(dir, 'questions.jsonl'), 'utf-8')

    const result = resolveComment(dir, c.id)

    expect(result.outcome).toBe('not-resolvable')
    expect(readFileSync(join(dir, 'questions.jsonl'), 'utf-8')).toBe(before)
  })

  it('rejects resolving a Comment that does not exist, appending nothing to the log', () => {
    expect(() => resolveComment(dir, 'does-not-exist')).not.toThrow()
    expect(existsSync(join(dir, 'questions.jsonl'))).toBe(false)

    const result = resolveComment(dir, 'does-not-exist')
    expect(result.outcome).toBe('not-found')
    expect(existsSync(join(dir, 'questions.jsonl'))).toBe(false)
  })

  it('never mutates existing log bytes when resolving — only appends', () => {
    const c = raiseQuestion(dir, 'Please fix', undefined, 'change-request')
    const before = readFileSync(join(dir, 'questions.jsonl'), 'utf-8')
    resolveComment(dir, c.id)
    const after = readFileSync(join(dir, 'questions.jsonl'), 'utf-8')
    expect(after.startsWith(before)).toBe(true)
  })
})
