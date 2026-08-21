import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type { Comparison, ReviewDocument } from '../schema/types.ts'

export interface Chain {
  mrKey: string
  round: number
  previousBundle: string
  previousHead: string
}

export interface RoundCheck {
  needsNewRound: boolean
  recordedHead: string
  liveHead: string
}

export interface ScaffoldRoundResult {
  bundlePath: string
  chain: Chain
}

export interface ScaffoldNextRoundOptions {
  /** The Unified Patch for the new round's base..liveHead Comparison. */
  patch: string
}

/**
 * A stable cross-round identity for one MR: repo slug + number, e.g.
 * "founda/application/xds-viewer-ui!367".
 */
export function mrKeyFor(comparison: Comparison): string {
  if (!comparison.repository || !comparison.number) {
    throw new Error('comparison.repository and comparison.number are required to compute an mrKey')
  }
  return `${comparison.repository}!${comparison.number}`
}

function readReviewDocument(bundlePath: string): ReviewDocument {
  return JSON.parse(readFileSync(join(bundlePath, 'review.json'), 'utf-8')) as ReviewDocument
}

/**
 * Reads a bundle directory name shaped like `<name>-r{N}` and splits it into
 * the chain's base name and that bundle's round number. A name with no
 * `-r{N}` suffix is round 1.
 */
function parseBundleDirName(dirName: string): { baseName: string; round: number } {
  const match = dirName.match(/^(.+)-r(\d+)$/)
  if (!match) return { baseName: dirName, round: 1 }
  return { baseName: match[1], round: Number(match[2]) }
}

/** The sibling bundle path a new round for `bundlePath` would scaffold into. */
export function nextRoundBundlePath(bundlePath: string): string {
  // Resolve first: basename/dirname on "." or ".." (a bundle path relative to
  // cwd, e.g. when invoked as `round .`) otherwise collapse to "." for both,
  // producing a literal "-r{N}" sibling nested inside the bundle itself
  // instead of a real sibling directory next to it.
  const resolved = resolve(bundlePath)
  const { baseName, round } = parseBundleDirName(basename(resolved))
  return join(dirname(resolved), `${baseName}-r${round + 1}`)
}

/**
 * Detects, purely from what's on disk plus a supplied live head, whether a
 * bundle's recorded Comparison has fallen behind its MR — the "new round"
 * case alongside New/Existing/Improve bundle determination.
 */
export function checkRound(bundlePath: string, liveHead: string): RoundCheck {
  const { comparison } = readReviewDocument(bundlePath)
  return { needsNewRound: comparison.head !== liveHead, recordedHead: comparison.head, liveHead }
}

/**
 * Scaffolds a new sibling round bundle for an MR whose live head has moved
 * past what `bundlePath` recorded. Never mutates `bundlePath` (ADR 0002) —
 * only creates the new `<name>-r{N}` directory alongside it, with its own
 * Comparison, Unified Patch, and a `chain.json` linking it back.
 */
export function scaffoldNextRound(
  bundlePath: string,
  liveHead: string,
  options: ScaffoldNextRoundOptions,
): ScaffoldRoundResult {
  const document = readReviewDocument(bundlePath)
  if (document.comparison.head === liveHead) {
    throw new Error(`Live head ${liveHead} matches the bundle's recorded head; no new round is needed`)
  }

  const resolvedBundlePath = resolve(bundlePath)
  const { round: currentRound } = parseBundleDirName(basename(resolvedBundlePath))
  const newBundlePath = nextRoundBundlePath(bundlePath)
  if (existsSync(newBundlePath)) {
    throw new Error(`Round bundle already exists at ${newBundlePath}`)
  }

  const chain: Chain = {
    mrKey: mrKeyFor(document.comparison),
    round: currentRound + 1,
    previousBundle: relative(newBundlePath, resolvedBundlePath),
    previousHead: document.comparison.head,
  }

  mkdirSync(newBundlePath, { recursive: true })
  writeFileSync(join(newBundlePath, 'changes.diff'), options.patch)
  writeFileSync(
    join(newBundlePath, 'review.json'),
    JSON.stringify(
      {
        schemaVersion: document.schemaVersion,
        comparison: { ...document.comparison, head: liveHead },
      },
      null,
      2,
    ),
  )
  writeFileSync(join(newBundlePath, 'chain.json'), JSON.stringify(chain, null, 2))

  return { bundlePath: newBundlePath, chain }
}
