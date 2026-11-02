import { describe, expect, it } from 'vitest'
import { formatDiagnostic } from './format-diagnostic.ts'

describe('formatDiagnostic', () => {
  it('starts with the diagnostic code', () => {
    expect(formatDiagnostic({ kind: 'missing-asset', assetPath: 'snap.png' })).toBe('missing-asset: Missing asset: snap.png')
  })

  it('names the file for a changed image without a pair', () => {
    expect(formatDiagnostic({ kind: 'image-without-comparison', path: 'a/b.png' })).toBe(
      'image-without-comparison: Changed image has no base and head asset: a/b.png',
    )
  })

  it('gives the detail for an unresolved target', () => {
    expect(formatDiagnostic({ kind: 'unresolved-target', targetType: 'hunk', path: 'a.ts', detail: 'hunk index 3 not found' })).toBe(
      'unresolved-target: Unresolved hunk target: hunk index 3 not found',
    )
  })

  it('gives the field and message for an invalid field', () => {
    expect(formatDiagnostic({ kind: 'invalid-field', instancePath: '/intent', message: 'must be object' })).toBe(
      'invalid-field: Invalid field (/intent): must be object',
    )
  })

  it('says which note has no verdict', () => {
    expect(formatDiagnostic({ kind: 'missing-verdict', annotationId: 'an-1' })).toBe(
      'missing-verdict: Note an-1 has no verdict. Set it to intended, missing, wrong, extra or unclear.',
    )
  })

  it('says which note has no suggestion', () => {
    expect(formatDiagnostic({ kind: 'missing-suggestion', annotationId: 'an-2', verdict: 'wrong' })).toBe(
      'missing-suggestion: Note an-2 has the verdict wrong but no suggestion. Say what to change.',
    )
  })

  it('gives the reason for a broken proof link', () => {
    expect(formatDiagnostic({ kind: 'invalid-proof-link', evidenceId: 'ev-1', detail: 'image a.png is not a changed image in the patch' })).toBe(
      'invalid-proof-link: Proof link in evidence ev-1 is broken: image a.png is not a changed image in the patch',
    )
  })
})
