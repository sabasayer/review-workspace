import { describe, expect, it } from 'vitest'
import { buildConcernComment, buildConcernComments, buildReport } from './report.ts'
import type { ReviewDocument } from '../schema/types.ts'
import type { ReviewState } from '../review-state/types.ts'

const document: ReviewDocument = {
  schemaVersion: 1,
  comparison: { base: 'abc1111', head: 'def2222' },
  behavioralGroups: [
    { id: 'bg-2', title: 'Second group', order: 1 },
    { id: 'bg-1', title: 'First group', order: 0 },
  ],
}

const state: ReviewState = {
  groups: {
    'bg-1': { understood: true, verified: true },
    'bg-2': { understood: true, verified: false },
  },
  concerns: [
    { id: 'c-1', note: 'check the timeout math', target: { type: 'line', path: 'src/a.ts', side: 'head', line: 10, expectedText: 'x' } },
    { id: 'c-2', note: 'no target concern' },
  ],
  notes: ['overall looks solid'],
  decision: 'request-changes',
}

describe('buildReport', () => {
  it('is read-only: never mutates the inputs it summarizes', () => {
    const docCopy = structuredClone(document)
    const stateCopy = structuredClone(state)
    buildReport(document, state)
    expect(document).toEqual(docCopy)
    expect(state).toEqual(stateCopy)
  })

  it('orders Behavioral Groups by declared order, not document order', () => {
    const report = buildReport(document, state)
    expect(report.indexOf('First group')).toBeLessThan(report.indexOf('Second group'))
  })

  it('reports understanding and verification per group distinctly', () => {
    const report = buildReport(document, state)
    expect(report).toContain('**First group** — understood: yes, verified: yes')
    expect(report).toContain('**Second group** — understood: yes, verified: no')
  })

  it('includes the decision, concerns, and notes', () => {
    const report = buildReport(document, state)
    expect(report).toContain('request-changes')
    expect(report).toContain('check the timeout math')
    expect(report).toContain('overall looks solid')
  })

  it('produces a self-contained Markdown string usable without the server', () => {
    const report = buildReport(document, state)
    expect(typeof report).toBe('string')
    expect(report.startsWith('# Review Report')).toBe(true)
  })
})

describe('buildConcernComments', () => {
  it('produces one comment per Concern, attributed to its Target when present', () => {
    const comments = buildConcernComments(state)
    expect(comments).toHaveLength(2)
    expect(comments[0]).toBe('[src/a.ts:10 (head)] check the timeout math')
    expect(comments[1]).toBe('no target concern')
  })

  it('exports a single concern comment independently of the full report', () => {
    expect(buildConcernComment(state.concerns[0])).toContain('src/a.ts:10')
  })
})
