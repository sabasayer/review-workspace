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

export interface Annotation {
  id: string
  target: Target
  summary: string
  kind?: 'intent' | 'behavior' | 'risk'
  evidenceIds?: string[]
  relatedTargets?: RelatedTarget[]
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

export interface ViewModel {
  comparison: Comparison
  groups: RenderedGroup[]
  files: RenderedFile[]
  diagnostics: Diagnostic[]
  generatorPrompt: string
  answers: Answer[]
}

export interface Question {
  id: string
  createdAt: string
  body: string
  target?: Target
  status: 'open' | 'withdrawn'
  supersededBy?: string
}
