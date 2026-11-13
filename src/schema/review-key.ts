import type { Comparison } from './types.ts'

/**
 * The name a Comparison goes by in file names: the MR number, or for a local
 * branch with no MR yet, the source branch made safe for a file name.
 */
export function reviewKey(comparison: Comparison): string | undefined {
  if (comparison.number) return comparison.number
  if (comparison.sourceBranch) return comparison.sourceBranch.replace(/[^A-Za-z0-9._-]+/g, '-')
  return undefined
}
