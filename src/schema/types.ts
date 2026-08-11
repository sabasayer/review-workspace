export type Target =
  | { type: 'file'; path: string }
  | { type: 'hunk'; path: string; hunkIndex: number }
  | { type: 'line'; path: string; side: 'base' | 'head'; line: number; expectedText: string }
  | { type: 'binary'; path: string }

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
  targets?: Target[]
}

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

export interface ReviewDocument {
  schemaVersion: number
  comparison: Comparison
  behavioralGroups?: BehavioralGroup[]
  annotations?: Annotation[]
  evidence?: Evidence[]
  verification?: VerificationItem[]
  answers?: Answer[]
  summary?: Summary
}
