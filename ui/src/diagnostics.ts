import type { Diagnostic } from './types.ts'

export function formatDiagnosticLabel(d: Diagnostic): string {
  switch (d.kind) {
    case 'stale-line-target':
      return `Stale annotation: ${d.detail}`
    case 'invalid-field':
      return `Invalid field (${d.instancePath}): ${d.message}`
    case 'unresolved-target':
      return `Unresolved ${d.targetType} target: ${d.detail}`
    case 'missing-asset':
      return `Missing asset: ${d.assetPath}`
    case 'unsafe-asset-path':
      return `Unsafe asset path: ${d.assetPath}`
    case 'disallowed-asset-type':
      return `Disallowed asset type: ${d.assetPath}`
    case 'asset-too-large':
      return `Asset too large (${d.bytes} bytes): ${d.assetPath}`
    case 'dangling-answer':
      return `Answer ${d.answerId} references unknown Question ${d.questionId}`
  }
}
