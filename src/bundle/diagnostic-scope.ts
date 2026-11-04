import type { Diagnostic } from './diagnostics.ts'

export type DiagnosticScope = 'document' | 'bundle'

const scopeByKind: Record<Diagnostic['kind'], DiagnosticScope> = {
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

export function diagnosticScope(diagnostic: Diagnostic): DiagnosticScope {
  return scopeByKind[diagnostic.kind]
}
