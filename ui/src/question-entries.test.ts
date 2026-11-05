import { describe, expect, it } from 'vitest'
import {
  buildLineTarget,
  countOpenChangeRequests,
  countOpenQuestions,
  fileLevelQuestions,
  generalComments,
  questionsForLine,
  resolveQuestionEntries,
  threadForNote,
  visibleQuestions,
} from './question-entries.ts'
import type { RenderedFile } from './types.ts'

const file: RenderedFile = {
  path: 'src/auth/login.ts',
  binary: false,
  verification: [],
  hunks: [
    {
      oldStart: 40,
      oldLines: 4,
      newStart: 40,
      newLines: 8,
      proofs: [],
      lines: [{ id: 'l-42', kind: 'add', text: '  if (x) {', newLine: 42, overflowsInline: false, annotations: [], diagnostics: [] }],
    },
  ],
  annotations: [],
  imageEvidence: [],
  proofs: [],
  proofFor: [],
  pipelineEvidence: [],
  diagnostics: [],
}

describe('resolveQuestionEntries', () => {
  it('resolves a line target to its hunk and line id', () => {
    const [entry] = resolveQuestionEntries(
      [file],
      [],
      [{ id: 'q1', createdAt: 't', body: 'why?', status: 'open', kind: 'question', resolved: false, originRound: 1, target: { type: 'line', path: 'src/auth/login.ts', side: 'head', line: 42, expectedText: '  if (x) {' } }],
    )
    expect(entry.hunkIndex).toBe(0)
    expect(entry.lineId).toBe('l-42')
  })

  it('counts open unanswered questions', () => {
    const entries = resolveQuestionEntries(
      [file],
      [{ id: 'a1', questionId: 'q2', body: 'because' }],
      [
        { id: 'q1', createdAt: 't', body: 'open', status: 'open', kind: 'question', resolved: false, originRound: 1 },
        { id: 'q2', createdAt: 't', body: 'answered', status: 'open', kind: 'question', resolved: false, originRound: 1 },
      ],
    )
    expect(countOpenQuestions(entries)).toBe(1)
  })

  it('does not count a change-request as an open Question', () => {
    const entries = resolveQuestionEntries(
      [file],
      [],
      [
        { id: 'q1', createdAt: 't', body: 'please fix', status: 'open', kind: 'change-request', resolved: false, originRound: 1 },
        { id: 'q2', createdAt: 't', body: 'why?', status: 'open', kind: 'question', resolved: false, originRound: 1 },
      ],
    )
    expect(countOpenQuestions(entries)).toBe(1)
  })

  it('counts open change-requests that are not fixed, and nothing else', () => {
    const entries = resolveQuestionEntries(
      [file],
      [],
      [
        { id: 'q1', createdAt: 't', body: 'fix', status: 'open', kind: 'change-request', resolved: false, originRound: 1 },
        { id: 'q2', createdAt: 't', body: 'fixed', status: 'open', kind: 'change-request', resolved: true, resolvedAt: 't2', originRound: 1 },
        { id: 'q3', createdAt: 't', body: 'gone', status: 'withdrawn', kind: 'change-request', resolved: false, originRound: 1 },
        { id: 'q4', createdAt: 't', body: 'why?', status: 'open', kind: 'question', resolved: false, originRound: 1 },
      ],
    )
    expect(countOpenChangeRequests(entries)).toBe(1)
  })
})

describe('question filters', () => {
  const questions = [
    { id: 'q1', createdAt: 't', body: 'file', status: 'open' as const, kind: 'question' as const, resolved: false, originRound: 1, target: { type: 'file' as const, path: 'src/auth/login.ts' } },
    { id: 'q2', createdAt: 't', body: 'line', status: 'open' as const, kind: 'question' as const, resolved: false, originRound: 1, target: { type: 'line' as const, path: 'src/auth/login.ts', side: 'head' as const, line: 42, expectedText: 'x' } },
  ]

  it('filters file-level and line-level questions', () => {
    expect(fileLevelQuestions(questions, 'src/auth/login.ts')).toHaveLength(1)
    expect(questionsForLine(questions, 'src/auth/login.ts', 'head', 42)).toHaveLength(1)
  })

  it('builds line targets preferring head side', () => {
    const head = buildLineTarget('src/a.ts', 'text', 1, 2)
    const base = buildLineTarget('src/a.ts', 'text', 1, undefined)
    expect(head.type === 'line' && head.side).toBe('head')
    expect(base.type === 'line' && base.side).toBe('base')
  })
})

describe('visibleQuestions', () => {
  const base = { createdAt: 't', body: 'q', kind: 'question' as const, resolved: false, originRound: 1 }

  it('hides a deleted comment but keeps open and rephrased ones', () => {
    const open = { ...base, id: 'open', status: 'open' as const }
    const rephrased = { ...base, id: 'old', status: 'withdrawn' as const, supersededBy: 'open' }
    const deleted = { ...base, id: 'gone', status: 'withdrawn' as const }
    expect(visibleQuestions([open, rephrased, deleted]).map((q) => q.id)).toEqual(['open', 'old'])
  })
})

describe('threadForNote', () => {
  const lineTarget = { type: 'line' as const, path: 'a.ts', side: 'head' as const, line: 3, expectedText: 'x' }
  const comment = (id: string, line: number) => ({
    id, createdAt: 't', body: id, kind: 'question' as const, status: 'open' as const, resolved: false, originRound: 1,
    target: { ...lineTarget, line },
  })

  it('returns only Comments on the same line, and nothing for a non-line note', () => {
    const questions = [comment('on-line', 3), comment('elsewhere', 9)]
    expect(threadForNote(questions, lineTarget).map((q) => q.id)).toEqual(['on-line'])
    expect(threadForNote(questions, { type: 'file', path: 'a.ts' })).toEqual([])
  })
})

describe('general Comments', () => {
  const base = { createdAt: 't', body: 'b', kind: 'question', status: 'open', resolved: false, originRound: 1 } as const

  it('keeps a general Comment out of the file and line views', () => {
    const general = { ...base, id: 'g', target: { type: 'general' } } as const
    expect(fileLevelQuestions([general], 'src/auth/login.ts')).toEqual([])
    expect(questionsForLine([general], 'src/auth/login.ts', 'head', 42)).toEqual([])
  })

  it('has no file to jump to', () => {
    const [entry] = resolveQuestionEntries([file], [], [{ ...base, id: 'g', target: { type: 'general' } }])
    expect(entry.filePath).toBeUndefined()
  })

  it('lists only the general Comments', () => {
    const general = { ...base, id: 'g', target: { type: 'general' } } as const
    const onFile = { ...base, id: 'f', target: { type: 'file', path: 'a.ts' } } as const
    const noTarget = { ...base, id: 'n' }
    expect(generalComments([onFile, general, noTarget]).map((q) => q.id)).toEqual(['g'])
  })
})
