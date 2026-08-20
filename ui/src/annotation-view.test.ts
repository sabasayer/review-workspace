import { describe, expect, it } from 'vitest'
import { collectVerificationEntries, countVerification, groupRiskLookup, splitHeadline, startHere } from './annotation-view.ts'
import type { Annotation, RenderedAnnotationVerification } from './types.ts'

function annotation(id: string, verification: Annotation['verification'] = []): Annotation {
  return { id, target: { type: 'file', path: 'a.ts' }, summary: 'x', evidence: [], verification }
}

function file(path: string, annotations: Annotation[], verification: RenderedAnnotationVerification[]) {
  return { path, annotations, verification }
}

describe('splitHeadline', () => {
  it('splits on the first period', () => {
    expect(splitHeadline('First clause. Rest of it.')).toEqual({ headline: 'First clause.', body: 'Rest of it.' })
  })

  it('splits on the first em-dash when no period comes first', () => {
    expect(splitHeadline('Headline — rest of the sentence.')).toEqual({ headline: 'Headline', body: 'rest of the sentence.' })
  })

  it('returns the whole text as headline with an empty body when neither separator is present', () => {
    expect(splitHeadline('One short claim')).toEqual({ headline: 'One short claim', body: '' })
  })
})

describe('countVerification', () => {
  it("tallies verification statuses across every file's own RenderedFile.verification", () => {
    const files = [
      file('a.ts', [], [{ id: 'v1', description: '', status: 'verified' }]),
      file('b.ts', [], [
        { id: 'v2', description: '', status: 'gap' },
        { id: 'v3', description: '', status: 'unverified' },
      ]),
    ]
    expect(countVerification(files)).toEqual({ verified: 1, unverified: 1, gap: 1 })
  })

  it('counts a Verification item that targets two file paths only once, not once per file', () => {
    const shared: RenderedAnnotationVerification = { id: 'v1', description: 'fixed in both places', status: 'verified' }
    const files = [file('a.ts', [], [shared]), file('b.png', [], [shared])]
    expect(countVerification(files)).toEqual({ verified: 1, unverified: 0, gap: 0 })
  })
})

describe('collectVerificationEntries', () => {
  it('tags each entry with the Annotation id it also appears on, when one exists', () => {
    const v1: RenderedAnnotationVerification = { id: 'v1', description: 'covered by a test', status: 'verified' }
    const files = [file('a.ts', [annotation('an-1', [v1])], [v1])]
    expect(collectVerificationEntries(files)).toEqual([{ verification: v1, annotationId: 'an-1', path: 'a.ts' }])
  })

  it('leaves annotationId undefined for a Verification item that only targets the file path (no Annotation names it)', () => {
    const v1: RenderedAnnotationVerification = { id: 'v1', description: 'pipeline green', status: 'verified' }
    const files = [file('a.ts', [annotation('an-1')], [v1])]
    expect(collectVerificationEntries(files)).toEqual([{ verification: v1, annotationId: undefined, path: 'a.ts' }])
  })

  it('dedupes a Verification item that targets two file paths into a single entry, keeping the first file encountered', () => {
    const shared: RenderedAnnotationVerification = { id: 'v1', description: 'fixed in both places', status: 'verified' }
    const files = [file('a.ts', [], [shared]), file('b.png', [], [shared])]
    expect(collectVerificationEntries(files)).toEqual([{ verification: shared, annotationId: undefined, path: 'a.ts' }])
  })
})

describe('startHere', () => {
  const files = [
    file('a1.ts', [], [{ id: 'v1', description: 'gap here', status: 'gap' }]),
    file('a2.ts', [], [{ id: 'v2', description: 'all good', status: 'verified' }]),
    file('a3.ts', [], [{ id: 'v3', description: 'unverified claim', status: 'unverified' }]),
  ]
  const groups = [
    { id: 'g1', title: 'g1', order: 1, risk: 'low' as const, filePaths: ['a1.ts'] },
    { id: 'g2', title: 'g2', order: 2, risk: 'high' as const, filePaths: ['a3.ts'] },
  ]

  it('keeps only non-verified entries, ordered by the risk of the file they concern', () => {
    const entries = collectVerificationEntries(files)
    const riskOf = groupRiskLookup(groups)
    const result = startHere(entries, riskOf)
    expect(result.map((e) => e.path)).toEqual(['a3.ts', 'a1.ts'])
  })
})
