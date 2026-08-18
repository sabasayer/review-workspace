import type { ParsedPatch, PatchHunk } from '../patch/types.ts'

/**
 * Both a round's own `changes.diff` and its predecessor's are full base..head patches
 * (ADR 0002 — every bundle is a real Comparison), so there is no git access to compute
 * `previousHead..head` directly (see framework.md's product boundary). Instead, a hunk
 * that appears verbatim in both is treated as unchanged since the previous round; one
 * that doesn't is incremental. This slightly over-reports "touched" when unrelated
 * earlier edits shift a hunk's line numbers without changing its content, which is the
 * conservative direction (never silently treats real change as untouched).
 */
function hunkFingerprint(hunk: PatchHunk): string {
  return JSON.stringify(hunk)
}

/** Hunks in `currentPatch`'s file at `path` that weren't present, verbatim, in `previousPatch`. A file absent from `previousPatch` counts as entirely incremental. */
export function incrementalHunks(previousPatch: ParsedPatch, currentPatch: ParsedPatch, path: string): PatchHunk[] {
  const currentFile = currentPatch.files.find((f) => f.path === path)
  if (!currentFile) return []

  const previousFile = previousPatch.files.find((f) => f.path === path)
  if (!previousFile) return currentFile.hunks

  const previousHunkKeys = new Set(previousFile.hunks.map(hunkFingerprint))
  return currentFile.hunks.filter((hunk) => !previousHunkKeys.has(hunkFingerprint(hunk)))
}

/** File paths in `currentPatch` with at least one hunk incremental since `previousPatch`. */
export function incrementalTouchedPaths(previousPatch: ParsedPatch, currentPatch: ParsedPatch): Set<string> {
  const touched = new Set<string>()
  for (const file of currentPatch.files) {
    if (incrementalHunks(previousPatch, currentPatch, file.path).length > 0) touched.add(file.path)
  }
  return touched
}
