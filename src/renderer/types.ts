import type { Annotation, Answer, CodeTarget, Comparison, GeneralTarget, Intent } from '../schema/types.ts'
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

export interface RenderedCodeAnnotation extends RenderedAnnotation {
  target: CodeTarget
}

export interface RenderedGeneralAnnotation extends RenderedAnnotation {
  target: GeneralTarget
}

export interface RenderedLine {
  id: string
  kind: 'context' | 'add' | 'remove'
  text: string
  oldLine?: number
  newLine?: number
  overflowsInline: boolean
  annotations: RenderedCodeAnnotation[]
  diagnostics: Diagnostic[]
}

/** A Proof link seen from the code side: the image that shows this change works. */
export interface RenderedProof {
  evidenceId: string
  caption: string
  /** Path of the changed image file in the patch — the image Target. */
  imagePath: string
  /** The head image to show, relative to `assets/`. */
  assetPath: string
  baseAssetPath?: string
}

/** A Proof link seen from the image side: the code it proves. */
export interface RenderedProofBackLink {
  evidenceId: string
  path: string
  hunkIndex?: number
  annotationId?: string
}

export interface RenderedHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: RenderedLine[]
  /** Proofs linked to this hunk, directly or through an Annotation on it or on one of its lines. */
  proofs: RenderedProof[]
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
  annotations: RenderedCodeAnnotation[]
  imageEvidence: RenderedImageEvidence[]
  pipelineEvidence: RenderedPipelineEvidence[]
  /** Proofs linked to the file as a whole, with no specific hunk. Hunk-level proofs are on the hunk. */
  proofs: RenderedProof[]
  /** For a changed image: the code it is a proof for. */
  proofFor: RenderedProofBackLink[]
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
  highlightAnnotations: RenderedCodeAnnotation[]
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
  intent?: Intent
  /** Annotations with a general Target (the whole Comparison). They belong to no file. */
  generalAnnotations: RenderedGeneralAnnotation[]
  /** Verification gaps (each counted once) plus general Annotations that are not `intended`. */
  openGaps: number
}
