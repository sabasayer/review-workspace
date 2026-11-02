import { describe, expect, it } from 'vitest'
import type { Annotation } from '../schema/types.ts'
import { countOpenGaps, isOpenGapAnnotation } from './open-gaps.ts'

const general = (verdict?: Annotation['verdict']): Annotation => ({ id: 'an', target: { type: 'general' }, summary: 's', verdict })

describe('isOpenGapAnnotation', () => {
  it.each(['missing', 'wrong', 'extra', 'unclear'] as const)('counts the verdict %s', (verdict) => {
    expect(isOpenGapAnnotation(general(verdict))).toBe(true)
  })

  it('does not count the verdict intended', () => {
    expect(isOpenGapAnnotation(general('intended'))).toBe(false)
  })

  it('counts a general note with no verdict', () => {
    expect(isOpenGapAnnotation(general())).toBe(true)
  })
})

describe('countOpenGaps', () => {
  const files = [
    { verification: [{ id: 'v1', status: 'gap' as const }, { id: 'v2', status: 'verified' as const }] },
    { verification: [{ id: 'v1', status: 'gap' as const }, { id: 'v3', status: 'unverified' as const }] },
  ]

  it('counts each Verification gap once across files', () => {
    expect(countOpenGaps(files, [])).toBe(1)
  })

  it('adds general notes that are gaps', () => {
    expect(countOpenGaps(files, [general('missing'), general('intended')])).toBe(2)
  })

  it('is zero with nothing to count', () => {
    expect(countOpenGaps([], [])).toBe(0)
  })
})
