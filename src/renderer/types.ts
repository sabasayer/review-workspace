import type { Annotation, Answer, Comparison } from '../schema/types.ts'
import type { Diagnostic } from '../bundle/diagnostics.ts'

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

export interface SideBySideRow {
  left: RenderedLine | null
  right: RenderedLine | null
}

export interface ViewModel {
  comparison: Comparison
  groups: RenderedGroup[]
  files: RenderedFile[]
  diagnostics: Diagnostic[]
  generatorPrompt: string
  answers: Answer[]
}
