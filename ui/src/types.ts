// Hand-duplicated from the engine's src/renderer/types.ts + src/bundle/diagnostics.ts.
// Deliberate ponytail cut: no pnpm workspace / shared-types package for one read-only
// HTTP boundary and ~40 lines of types. Revisit only if drift becomes a real problem.

export type Diagnostic =
  | { kind: 'invalid-field'; instancePath: string; message: string }
  | { kind: 'unresolved-target'; targetType: 'file' | 'hunk' | 'binary'; path: string; detail: string }
  | { kind: 'stale-line-target'; path: string; side: 'base' | 'head'; line: number; expectedText: string; detail: string }
  | { kind: 'missing-asset'; assetPath: string }
  | { kind: 'unsafe-asset-path'; assetPath: string }
  | { kind: 'disallowed-asset-type'; assetPath: string }
  | { kind: 'asset-too-large'; assetPath: string; bytes: number }
  | { kind: 'dangling-answer'; answerId: string; questionId: string }

export type Target =
  | { type: 'file'; path: string }
  | { type: 'hunk'; path: string; hunkIndex: number }
  | { type: 'line'; path: string; side: 'base' | 'head'; line: number; expectedText: string }
  | { type: 'binary'; path: string }

export interface RelatedTarget {
  target: Target
  reason: string
}

export interface RenderedAnnotationEvidence {
  id: string
  kind: 'observed' | 'author-claim' | 'inference'
  description: string
  pipeline?: { jobName: string; status: 'success' | 'failed' | 'running' | 'canceled' | 'skipped'; url: string }
}

export interface RenderedAnnotationVerification {
  id: string
  description: string
  status: 'unverified' | 'verified' | 'gap'
}

export interface Annotation {
  id: string
  target: Target
  summary: string
  kind?: 'intent' | 'behavior' | 'risk'
  evidenceIds?: string[]
  relatedTargets?: RelatedTarget[]
  evidence: RenderedAnnotationEvidence[]
  verification: RenderedAnnotationVerification[]
}

export interface RenderedLine {
  id: string
  kind: 'context' | 'add' | 'remove'
  text: string
  oldLine?: number
  newLine?: number
  overflowsInline: boolean
  annotations: Annotation[]
  diagnostics: Diagnostic[]
}

export interface RenderedHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: RenderedLine[]
}

export interface RenderedImageEvidence {
  id: string
  assetPath: string
  baseAssetPath?: string
  description: string
  comparisonModes: Array<'side-by-side' | 'swipe' | 'onion-skin' | 'changed-pixel'>
}

export interface RenderedPipelineEvidence {
  id: string
  jobName: string
  status: 'success' | 'failed' | 'running' | 'canceled' | 'skipped'
  url: string
  logExcerpt?: string
  description: string
}

export interface RenderedFile {
  path: string
  oldPath?: string
  binary: boolean
  hunks: RenderedHunk[]
  annotations: Annotation[]
  imageEvidence: RenderedImageEvidence[]
  pipelineEvidence: RenderedPipelineEvidence[]
  /** Every Verification item targeting this file, directly or via one of its Annotations — a superset of any single Annotation's own `.verification`. */
  verification: RenderedAnnotationVerification[]
  diagnostics: Diagnostic[]
}

export interface RenderedGroup {
  id: string
  title: string
  description?: string
  order: number
  risk?: 'low' | 'medium' | 'high'
  filePaths: string[]
}

export interface Comparison {
  base: string
  head: string
  repository?: string
  title?: string
  number?: string
  url?: string
  author?: string
  sourceBranch?: string
  targetBranch?: string
  description?: string
}

export interface Answer {
  id: string
  questionId: string
  body: string
  evidenceIds?: string[]
}

export interface RenderedSummary {
  text: string
  highlightAnnotations: Annotation[]
  highlightPaths: string[]
}

export interface ViewModel {
  comparison: Comparison
  /** This bundle's own round number in its chain — 1 for a bundle with no `chain.json`. */
  round: number
  groups: RenderedGroup[]
  files: RenderedFile[]
  diagnostics: Diagnostic[]
  generatorPrompt: string
  answers: Answer[]
  summary?: RenderedSummary
}

export type CommentKind = 'question' | 'change-request'

export type ResolutionStatus = 'target-touched' | 'target-partially-touched' | 'target-untouched' | 'target-gone'

export interface Resolution {
  commentId: string
  status: ResolutionStatus
  evidence: string
}

export interface Question {
  id: string
  createdAt: string
  body: string
  target?: Target
  kind: CommentKind
  status: 'open' | 'withdrawn'
  supersededBy?: string
  resolved: boolean
  resolvedAt?: string
  /** The round this comment was first raised in — 1 for a comment raised on the original bundle. */
  originRound: number
  /** Present only for a comment carried forward from the previous round and still open. */
  resolution?: Resolution
}
