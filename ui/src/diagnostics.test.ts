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
})
