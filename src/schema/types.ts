export type CodeTarget =
  | { type: 'file'; path: string }
  | { type: 'hunk'; path: string; hunkIndex: number }
  | { type: 'line'; path: string; side: 'base' | 'head'; line: number; expectedText: string }
  | { type: 'binary'; path: string }

/** The whole Comparison, for a finding with no code line. */
export interface GeneralTarget {
  type: 'general'
}

export type Target = CodeTarget | GeneralTarget

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

export interface BehavioralGroup {
  id: string
  title: string
  description?: string
  order: number
  risk?: 'low' | 'medium' | 'high'
  targets?: CodeTarget[]
}

export interface RelatedTarget {
  target: CodeTarget
  reason: string
}

export const ANNOTATION_VERDICTS = ['intended', 'missing', 'wrong', 'extra', 'unclear'] as const
export type AnnotationVerdict = (typeof ANNOTATION_VERDICTS)[number]

export const ANNOTATION_SOURCES = ['issue', 'mr-text', 'repo-rule', 'nobody'] as const
export type AnnotationSource = (typeof ANNOTATION_SOURCES)[number]

export interface Annotation {
  id: string
  target: Target
  summary: string
  kind?: 'intent' | 'behavior' | 'risk'
  /** Whether the behaviour is what was asked for. Required from schemaVersion 2. */
  verdict?: AnnotationVerdict
  severity?: 'low' | 'medium' | 'high'
  /** Who asked for the behaviour. */
  source?: AnnotationSource
  /** What to change. Required from schemaVersion 2 when the verdict is `wrong` or `missing`. */
  suggestion?: string
  evidenceIds?: string[]
  /** A Target in a *different* file this annotation's claim depends on, with why. No call-graph inference — just what the Generator already read. */
  relatedTargets?: RelatedTarget[]
}

export interface PipelineEvidence {
  jobName: string
  status: 'success' | 'failed' | 'running' | 'canceled' | 'skipped'
  url: string
  /** Excerpt of the job's log (e.g. the failing assertion/stack trace), not the full trace. */
  logExcerpt?: string
}

export interface Evidence {
  id: string
  kind: 'observed' | 'author-claim' | 'inference'
  description: string
  targetIds?: string[]
  /** When paired with baseAssetPath, this is the head-revision image. */
  assetPath?: string
  baseAssetPath?: string
  /** A CI job this Evidence is drawn from — e.g. a failure that explains a Verification gap. */
  pipeline?: PipelineEvidence
}

export interface VerificationItem {
  id: string
  description: string
  status: 'unverified' | 'verified' | 'gap'
  targetIds?: string[]
  /** Opts a `gap` with no concrete anchor out of `unanchored-verification-gap` — for a concern that's genuinely not about one place (a missing dashboard, an unrunnable pipeline), not a stand-in for writing the anchor. */
  diffuse?: boolean
}

export interface Answer {
  id: string
  questionId: string
  body: string
  evidenceIds?: string[]
}

export interface Summary {
  text: string
  /** Ids of the Annotations most worth a reviewer reading first. */
  highlightAnnotationIds?: string[]
  /** Paths of the files most worth a reviewer reading first. */
  highlightPaths?: string[]
}

export interface IntentVisual {
  /** The head image of a snapshot pair, or the only image. Path relative to `assets/`. */
  assetPath: string
  /** The base image of a snapshot pair. Only for `source: 'snapshot'`. */
  baseAssetPath?: string
  caption: string
  source: 'mr-text' | 'snapshot'
}

export interface Intent {
  /** What the Comparison does, in plain words. */
  does: string
  why: string
  /** Things a reader might expect but the Comparison does not do. */
  doesNot?: string[]
  /** Where the claims come from, e.g. "MR text", "Linear ENG-2684", "CODING_STANDARDS.md". */
  sources: string[]
  /** Set only when the MR text is too weak to state the intent; says what is missing. */
  weakDescription?: string
  visuals?: IntentVisual[]
}

export interface ReviewDocument {
  schemaVersion: number
  comparison: Comparison
  behavioralGroups?: BehavioralGroup[]
  annotations?: Annotation[]
  evidence?: Evidence[]
  verification?: VerificationItem[]
  answers?: Answer[]
  summary?: Summary
  intent?: Intent
}
