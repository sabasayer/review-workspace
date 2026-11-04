import { describe, expect, it } from 'vitest'
import { diagnosticScope } from './diagnostic-scope.ts'
import type { Diagnostic } from './diagnostics.ts'

const expectedScopeByKind: Record<Diagnostic['kind'], 'document' | 'bundle'> = {
  'invalid-field': 'document',
  'unresolved-target': 'document',
  'stale-line-target': 'document',
  'dangling-answer': 'document',
  'unanchored-verification-gap': 'document',
  'missing-verdict': 'document',
  'missing-suggestion': 'document',
  'invalid-proof-link': 'document',
  'missing-asset': 'bundle',
  'unsafe-asset-path': 'bundle',
  'disallowed-asset-type': 'bundle',
  'asset-too-large': 'bundle',
  'image-without-comparison': 'bundle',
}

describe('diagnosticScope', () => {
  it.each(Object.entries(expectedScopeByKind))('%s is in scope %s', (kind, scope) => {
    expect(diagnosticScope({ kind } as Diagnostic)).toBe(scope)
  })
})
