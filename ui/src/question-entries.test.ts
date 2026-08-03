import { describe, expect, it } from 'vitest'
import {
  buildLineTarget,
  countOpenQuestions,
  fileLevelQuestions,
  questionsForLine,
  resolveQuestionEntries,
} from './question-entries.ts'
import type { RenderedFile } from './types.ts'

const file: RenderedFile = {
  path: 'src/auth/login.ts',
  binary: false,
  hunks: [
    {
      oldStart: 40,
      oldLines: 4,
      newStart: 40,
      newLines: 8,
      lines: [{ id: 'l-42', kind: 'add', text: '  if (x) {', newLine: 42, overflowsInline: false, annotations: [], diagnostics: [] }],
    },
  ],
  annotations: [],
  imageEvidence: [],
  pipelineEvidence: [],
  diagnostics: [],
}

describe('resolveQuestionEntries', () => {
  it('resolves a line target to its hunk and line id', () => {
    const [entry] = resolveQuestionEntries(
      [file],
      [],
      [{ id: 'q1', createdAt: 't', body: 'why?', status: 'open', target: { type: 'line', path: 'src/auth/login.ts', side: 'head', line: 42, expectedText: '  if (x) {' } }],
    )
    expect(entry.hunkIndex).toBe(0)
    expect(entry.lineId).toBe('l-42')
  })

  it('counts open unanswered questions', () => {
    const entries = resolveQuestionEntries(
      [file],
      [{ id: 'a1', questionId: 'q2', body: 'because' }],
      [
        { id: 'q1', createdAt: 't', body: 'open', status: 'open' },
        { id: 'q2', createdAt: 't', body: 'answered', status: 'open' },
      ],
    )
    expect(countOpenQuestions(entries)).toBe(1)
  })
})

describe('question filters', () => {
  const questions = [
    { id: 'q1', createdAt: 't', body: 'file', status: 'open' as const, target: { type: 'file' as const, path: 'src/auth/login.ts' } },
    { id: 'q2', createdAt: 't', body: 'line', status: 'open' as const, target: { type: 'line' as const, path: 'src/auth/login.ts', side: 'head' as const, line: 42, expectedText: 'x' } },
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
