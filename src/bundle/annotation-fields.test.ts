import { describe, expect, it } from 'vitest'
import type { Annotation, ReviewDocument } from '../schema/types.ts'
import { checkAnnotationFields } from './annotation-fields.ts'

const target = { type: 'file', path: 'a.ts' } as const

function documentWith(schemaVersion: number, ...annotations: Partial<Annotation>[]): ReviewDocument {
  return {
    schemaVersion,
    comparison: { base: 'a', head: 'b' },
    annotations: annotations.map((a, i) => ({ id: `an-${i + 1}`, target, summary: 's', ...a })),
  }
}

describe('checkAnnotationFields', () => {
  it('reports no problem for a version 2 note with a verdict', () => {
    expect(checkAnnotationFields(documentWith(2, { verdict: 'intended' }))).toEqual([])
  })

  it('reports a missing verdict on a version 2 note', () => {
    expect(checkAnnotationFields(documentWith(2, {}))).toEqual([{ kind: 'missing-verdict', annotationId: 'an-1' }])
  })

  it.each(['wrong', 'missing'] as const)('reports a missing suggestion for the verdict %s', (verdict) => {
    expect(checkAnnotationFields(documentWith(2, { verdict }))).toEqual([
      { kind: 'missing-suggestion', annotationId: 'an-1', verdict },
    ])
  })

  it('reports a blank suggestion as missing', () => {
    expect(checkAnnotationFields(documentWith(2, { verdict: 'wrong', suggestion: '   ' }))).toHaveLength(1)
  })

  it.each(['intended', 'extra', 'unclear'] as const)('does not need a suggestion for the verdict %s', (verdict) => {
    expect(checkAnnotationFields(documentWith(2, { verdict }))).toEqual([])
  })

  it('accepts a wrong verdict with a suggestion', () => {
    expect(checkAnnotationFields(documentWith(2, { verdict: 'wrong', suggestion: 'Use the config value.' }))).toEqual([])
  })

  it('does not check notes in a version 1 document', () => {
    expect(checkAnnotationFields(documentWith(1, {}, { verdict: 'wrong' }))).toEqual([])
  })

  it('returns nothing for a document with no notes', () => {
    expect(checkAnnotationFields({ schemaVersion: 2, comparison: { base: 'a', head: 'b' } })).toEqual([])
  })
})
