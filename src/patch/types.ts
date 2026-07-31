export interface PatchLine {
  kind: 'context' | 'add' | 'remove'
  text: string
  oldLine?: number
  newLine?: number
}

export interface PatchHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: PatchLine[]
}

export interface PatchFile {
  path: string
  oldPath?: string
  binary: boolean
  hunks: PatchHunk[]
}

export interface ParsedPatch {
  files: PatchFile[]
}

export class PatchParseError extends Error {}
