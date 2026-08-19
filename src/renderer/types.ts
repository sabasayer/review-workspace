import type { Annotation, Answer, Comparison } from '../schema/types.ts'
import type { Diagnostic } from '../bundle/diagnostics.ts'

/** An Evidence item resolved from one of an Annotation's own `evidenceIds`. */
export interface RenderedAnnotationEvidence {
  id: string
  kind: 'observed' | 'author-claim' | 'inference'
  description: string
  pipeline?: { jobName: string; status: 'success' | 'failed' | 'running' | 'canceled' | 'skipped'; url: string }
}

/** A Verification item resolved from `verification[].targetIds` naming this Annotation's id. */
export interface RenderedAnnotationVerification {
  id: string
  description: string
  status: 'unverified' | 'verified' | 'gap'
}

export interface RenderedAnnotation extends Annotation {
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
  annotations: RenderedAnnotation[]
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
  /** The head-revision image when paired with baseAssetPath, otherwise the only image. */
  assetPath: string
  baseAssetPath?: string
  description: string
  /** Only populated when baseAssetPath is present — a single image has nothing to compare against. */
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
  annotations: RenderedAnnotation[]
  imageEvidence: RenderedImageEvidence[]
  pipelineEvidence: RenderedPipelineEvidence[]
  /**
   * Every Verification item targeting this file, directly (`targetIds` names the
   * file's path) or via one of its Annotations (`targetIds` names the Annotation's
   * id) — a superset of what any single Annotation's own `.verification` carries,
   * since a Verification item commonly targets Evidence ids and a file path
   * together without naming any specific Annotation at all.
   */
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

export interface SideBySideRow {
  left: RenderedLine | null
  right: RenderedLine | null
}

export interface RenderedSummary {
  text: string
  highlightAnnotations: RenderedAnnotation[]
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
