import type { RenderedLine } from './types.ts'

export interface SideBySideRow {
  left: RenderedLine | null
  right: RenderedLine | null
}

export function anchorId(path: string): string {
  return `file-${path.replace(/[^a-zA-Z0-9]/g, '-')}`
}

// RenderedLine.id is "<path>#<hunkIndex>#<lineIndex>" — not a valid DOM id as-is (# and
// path separators). Same sanitization as anchorId, applied to a line instead of a file.
export function lineAnchorId(lineId: string): string {
  return `line-${lineId.replace(/[^a-zA-Z0-9]/g, '-')}`
}

// Mirrors the engine's src/renderer/render.ts toSideBySideRows — duplicated for the
// same reason as types.ts (no shared-package plumbing for a ~25-line pure function yet).
export function toSideBySideRows(lines: RenderedLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].kind === 'context') {
      rows.push({ left: lines[i], right: lines[i] })
      i++
      continue
    }
    const removes: RenderedLine[] = []
    while (i < lines.length && lines[i].kind === 'remove') {
      removes.push(lines[i])
      i++
    }
    const adds: RenderedLine[] = []
    while (i < lines.length && lines[i].kind === 'add') {
      adds.push(lines[i])
      i++
    }
    const max = Math.max(removes.length, adds.length)
    for (let j = 0; j < max; j++) {
      rows.push({ left: removes[j] ?? null, right: adds[j] ?? null })
    }
  }
  return rows
}
