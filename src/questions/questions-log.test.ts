import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { raiseQuestion, readQuestions, withdrawAndReplaceQuestion } from './questions-log.ts'

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
})
