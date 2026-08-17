import { describe, expect, it } from 'vitest'
import { buildReport } from './report.ts'
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

  it('includes the decision and notes', () => {
    const report = buildReport(document, state)
    expect(report).toContain('request-changes')
    expect(report).toContain('overall looks solid')
  })

  it('produces a self-contained Markdown string usable without the server', () => {
    const report = buildReport(document, state)
    expect(typeof report).toBe('string')
    expect(report.startsWith('# Review Report')).toBe(true)
  })
})
