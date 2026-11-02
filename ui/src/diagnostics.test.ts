import { describe, expect, it } from 'vitest'
import { formatDiagnosticLabel } from './diagnostics.ts'

describe('formatDiagnosticLabel', () => {
  it('formats stale line targets', () => {
    expect(
      formatDiagnosticLabel({
        kind: 'stale-line-target',
        path: 'a.ts',
        side: 'head',
        line: 1,
        expectedText: 'x',
        detail: 'mismatch',
      }),
    ).toBe('Stale annotation: mismatch')
  })

  it('formats missing assets', () => {
    expect(formatDiagnosticLabel({ kind: 'missing-asset', assetPath: 'snap.png' })).toBe('Missing asset: snap.png')
  })

  it('formats unanchored verification gaps', () => {
    expect(formatDiagnosticLabel({ kind: 'unanchored-verification-gap', verificationId: 'vi-1', detail: 'targetIds is empty' })).toBe(
      'Verification gap vi-1 has no concrete anchor: targetIds is empty',
    )
  })

  it('formats a changed image without a pair', () => {
    expect(formatDiagnosticLabel({ kind: 'image-without-comparison', path: 'a/b.png' })).toBe('Changed image has no base and head asset: a/b.png')
  })

  it('formats a note with no verdict', () => {
    expect(formatDiagnosticLabel({ kind: 'missing-verdict', annotationId: 'an-1' })).toBe(
      'Note an-1 has no verdict. Set it to intended, missing, wrong, extra or unclear.',
    )
  })

  it('formats a note with no suggestion', () => {
    expect(formatDiagnosticLabel({ kind: 'missing-suggestion', annotationId: 'an-2', verdict: 'missing' })).toBe(
      'Note an-2 has the verdict missing but no suggestion. Say what to change.',
    )
  })

  it('formats a broken proof link', () => {
    expect(formatDiagnosticLabel({ kind: 'invalid-proof-link', evidenceId: 'ev-1', detail: 'x' })).toBe('Proof link in evidence ev-1 is broken: x')
  })
})
