export type Diagnostic =
  | { kind: 'invalid-field'; instancePath: string; message: string }
  | { kind: 'unresolved-target'; targetType: 'file' | 'hunk' | 'binary'; path: string; detail: string }
  | { kind: 'stale-line-target'; path: string; side: 'base' | 'head'; line: number; expectedText: string; detail: string }
  | { kind: 'missing-asset'; assetPath: string }
  | { kind: 'unsafe-asset-path'; assetPath: string }
  | { kind: 'disallowed-asset-type'; assetPath: string }
  | { kind: 'asset-too-large'; assetPath: string; bytes: number }
  | { kind: 'image-without-comparison'; path: string }
  | { kind: 'dangling-answer'; answerId: string; questionId: string }
  | { kind: 'unanchored-verification-gap'; verificationId: string; detail: string }
  | { kind: 'missing-verdict'; annotationId: string }
  | { kind: 'missing-suggestion'; annotationId: string; verdict: 'wrong' | 'missing' }
  | { kind: 'invalid-proof-link'; evidenceId: string; detail: string }
