import type { ParsedPatch } from '../patch/types.ts'
import type { Target } from '../schema/types.ts'
import type { Comment } from '../questions/types.ts'
import { resolveTarget } from './resolve-diagnostics.ts'
import { incrementalHunks } from './incremental-patch.ts'

export type ResolutionStatus = 'claimed-addressed' | 'claimed-partial' | 'claimed-not-addressed' | 'target-gone'

/**
 * Evidence-backed but never authoritative (framework.md, ADR 0002): a claim the engine
 * derives by observing the incremental patch, never a decision. Only the Reviewer's own
 * `resolveComment` action (from #9) can actually close a change-request Comment.
 */
export interface Resolution {
  commentId: string
  status: ResolutionStatus
  evidence: string
}

function targetHunkIndex(target: Target, patch: ParsedPatch): number | undefined {
  const file = patch.files.find((f) => f.path === target.path)
  if (!file) return undefined
  if (target.type === 'hunk') return target.hunkIndex
  if (target.type !== 'line') return undefined
  return file.hunks.findIndex((h) =>
    h.lines.some((l) => (target.side === 'base' ? l.oldLine === target.line : l.newLine === target.line)),
  )
}

/**
 * Evaluates one carried-forward change-request Comment against the round's incremental
 * patch. `target-gone` reuses the same Target-resolution logic the engine already uses
 * to flag stale Targets in `resolve-diagnostics.ts`, rather than reinventing it.
 */
export function evaluateResolution(comment: Comment, previousPatch: ParsedPatch, currentPatch: ParsedPatch): Resolution {
  const target = comment.target

  if (!target) {
    const anyIncrementalChange = currentPatch.files.some((f) => incrementalHunks(previousPatch, currentPatch, f.path).length > 0)
    return anyIncrementalChange
      ? {
          commentId: comment.id,
          status: 'claimed-partial',
          evidence: 'The incremental patch changed other content, but this comment has no Target to correlate against.',
        }
      : { commentId: comment.id, status: 'claimed-not-addressed', evidence: 'No incremental changes were made in this round.' }
  }

  const staleDiagnostic = resolveTarget(target, currentPatch)
  if (staleDiagnostic) {
    const detail = 'detail' in staleDiagnostic ? staleDiagnostic.detail : 'the Target no longer resolves'
    return {
      commentId: comment.id,
      status: 'target-gone',
      evidence: `The comment's original Target no longer resolves against this round's patch: ${detail}`,
    }
  }

  const touchedHunks = incrementalHunks(previousPatch, currentPatch, target.path)
  if (touchedHunks.length === 0) {
    return {
      commentId: comment.id,
      status: 'claimed-not-addressed',
      evidence: `${target.path} has no incremental changes since the previous round.`,
    }
  }

  if (target.type === 'file' || target.type === 'binary') {
    return {
      commentId: comment.id,
      status: 'claimed-partial',
      evidence: `${touchedHunks.length} hunk(s) changed in ${target.path} since the previous round.`,
    }
  }

  const currentFile = currentPatch.files.find((f) => f.path === target.path)!
  const hunkIndex = targetHunkIndex(target, currentPatch)
  const targetedHunkChanged = hunkIndex !== undefined && hunkIndex >= 0 && touchedHunks.includes(currentFile.hunks[hunkIndex])

  return targetedHunkChanged
    ? {
        commentId: comment.id,
        status: 'claimed-addressed',
        evidence: `The hunk containing this comment's Target changed in the incremental patch.`,
      }
    : {
        commentId: comment.id,
        status: 'claimed-partial',
        evidence: `${target.path} changed elsewhere in the incremental patch, but not at this comment's exact Target.`,
      }
}
