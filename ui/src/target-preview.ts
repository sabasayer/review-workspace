import type { RenderedFile, RenderedLine, Target } from './types.ts'

export interface TargetPreview {
  path: string
  lines: RenderedLine[]
}

const CONTEXT_LINES = 3

// A `file`/`binary` Target has no single spot to preview — only `hunk`/`line` resolve.
export function resolveTargetPreview(files: RenderedFile[], target: Target): TargetPreview | null {
  const file = files.find((f) => f.path === target.path)
  if (!file) return null

  if (target.type === 'hunk') {
    const hunk = file.hunks[target.hunkIndex]
    return hunk ? { path: target.path, lines: hunk.lines } : null
  }

  if (target.type === 'line') {
    for (const hunk of file.hunks) {
      const index = hunk.lines.findIndex((l) => (target.side === 'base' ? l.oldLine === target.line : l.newLine === target.line))
      if (index === -1) continue
      const start = Math.max(0, index - CONTEXT_LINES)
      const end = Math.min(hunk.lines.length, index + CONTEXT_LINES + 1)
      return { path: target.path, lines: hunk.lines.slice(start, end) }
    }
    return null
  }

  return null
}
