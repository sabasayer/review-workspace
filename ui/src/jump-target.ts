import { lineIdsForTarget } from './line-highlight.ts'
import type { CodeTarget, RenderedFile } from './types.ts'

export function canJumpToTarget(target: CodeTarget): boolean {
  return target.type === 'line' || target.type === 'hunk'
}

export function jumpTargetLineId(files: readonly RenderedFile[], target: CodeTarget): string | undefined {
  if (target.type === 'line') return lineIdsForTarget(files, target)[0]
  if (target.type === 'hunk') return files.find((f) => f.path === target.path)?.hunks[target.hunkIndex]?.lines[0]?.id
  return undefined
}
