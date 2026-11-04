import { describe, expect, it } from 'vitest'
import type { Diagnostic } from './diagnostics.ts'
import { diagnosticToJson, formatDiagnostic, formatDiagnosticGroups } from './format-diagnostic.ts'

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

describe('diagnosticToJson', () => {
  it('keeps the fields and adds the scope', () => {
    expect(diagnosticToJson({ kind: 'missing-asset', assetPath: 'snap.png' })).toEqual({
      kind: 'missing-asset',
      assetPath: 'snap.png',
      scope: 'bundle',
      message: 'Missing asset: snap.png',
    })
  })

  it('replaces the raw message of an invalid field with the formatted text', () => {
    const json = diagnosticToJson({ kind: 'invalid-field', instancePath: '/intent', message: 'must be object' })
    expect(json).toMatchObject({ scope: 'document', instancePath: '/intent', message: 'Invalid field (/intent): must be object' })
  })
})

describe('formatDiagnosticGroups', () => {
  const documentDiagnostic: Diagnostic = { kind: 'unresolved-target', targetType: 'file', path: 'a.ts', detail: 'not found' }
  const bundleDiagnostic: Diagnostic = { kind: 'missing-asset', assetPath: 'snap.png' }

  it('puts the review group before the bundle group', () => {
    expect(formatDiagnosticGroups([bundleDiagnostic, documentDiagnostic])).toEqual([
      'In the review (fix these):',
      '  unresolved-target: Unresolved file target: not found',
      'In the bundle files:',
      '  missing-asset: Missing asset: snap.png',
    ])
  })

  it('drops a group with no diagnostics', () => {
    expect(formatDiagnosticGroups([bundleDiagnostic])).toEqual(['In the bundle files:', '  missing-asset: Missing asset: snap.png'])
  })

  it('gives no lines when there are no diagnostics', () => {
    expect(formatDiagnosticGroups([])).toEqual([])
  })
})
