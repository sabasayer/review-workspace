import type { Diagnostic } from './diagnostics.ts'

function describeDiagnostic(d: Diagnostic): string {
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
    case 'image-without-comparison':
      return `Changed image has no base and head asset: ${d.path}`
    case 'dangling-answer':
      return `Answer ${d.answerId} references unknown Question ${d.questionId}`
    case 'unanchored-verification-gap':
      return `Verification gap ${d.verificationId} has no concrete anchor: ${d.detail}`
    case 'missing-verdict':
      return `Note ${d.annotationId} has no verdict. Set it to intended, missing, wrong, extra or unclear.`
    case 'missing-suggestion':
      return `Note ${d.annotationId} has the verdict ${d.verdict} but no suggestion. Say what to change.`
    case 'invalid-proof-link':
      return `Proof link in evidence ${d.evidenceId} is broken: ${d.detail}`
  }
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.kind}: ${describeDiagnostic(d)}`
}
