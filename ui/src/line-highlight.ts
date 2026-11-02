import type { CodeTarget, RenderedFile } from './types.ts'

export function lineIdsForTarget(files: readonly RenderedFile[], target: CodeTarget): string[] {
  if (target.type !== 'line') return []
  const file = files.find((f) => f.path === target.path)
  if (!file) return []
  const ids: string[] = []
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const number = target.side === 'base' ? line.oldLine : line.newLine
      if (number === target.line) ids.push(line.id)
    }
  }
  return ids
}
