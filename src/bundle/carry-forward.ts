import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Annotation, BehavioralGroup, ReviewDocument, Target } from '../schema/types.ts'
import { parsePatch } from '../patch/parse.ts'
import type { ParsedPatch } from '../patch/types.ts'
import { carryForwardComment, readQuestions } from '../questions/questions-log.ts'
import type { Comment } from '../questions/types.ts'
import type { Chain } from './round.ts'
import { evaluateResolution, type Resolution } from './resolution.ts'
import { incrementalTouchedPaths } from './incremental-patch.ts'

// `chain.json`, `changes.diff`, and (for an ancestor bundle) `review.json` are all
// write-once bundle inputs — round N's chain never changes after `scaffoldNextRound`
// writes it, and a bundle's own `changes.diff` is never rewritten in place. Only the
// *current* round's `review.json` (via publish) and `questions.jsonl` (via Reviewer
// actions) mutate during a live session, and neither is read through these caches.
// Caching them by bundlePath avoids re-reading and re-parsing every ancestor bundle's
// files on every call in the same request/render — `render()`, `computeCarriedResolutions`,
// `collectCommentHistory`, and `collectCarriedReviewContent` all walk the same chain.
const chainCache = new Map<string, Chain | undefined>()
const patchCache = new Map<string, ParsedPatch>()
const reviewDocumentCache = new Map<string, ReviewDocument>()

export function readChain(bundlePath: string): Chain | undefined {
  if (!chainCache.has(bundlePath)) {
    const path = join(bundlePath, 'chain.json')
    chainCache.set(bundlePath, existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as Chain) : undefined)
  }
  return chainCache.get(bundlePath)
}

export function resolvePreviousBundlePath(bundlePath: string, chain: Chain): string {
  return resolve(bundlePath, chain.previousBundle)
}

function readPatch(bundlePath: string): ParsedPatch {
  if (!patchCache.has(bundlePath)) {
    patchCache.set(bundlePath, parsePatch(readFileSync(join(bundlePath, 'changes.diff'), 'utf-8')))
  }
  return patchCache.get(bundlePath)!
}

function readReviewDocument(bundlePath: string): ReviewDocument {
  if (!reviewDocumentCache.has(bundlePath)) {
    reviewDocumentCache.set(bundlePath, JSON.parse(readFileSync(join(bundlePath, 'review.json'), 'utf-8')) as ReviewDocument)
  }
  return reviewDocumentCache.get(bundlePath)!
}

function openChangeRequests(bundlePath: string): Comment[] {
  return readQuestions(bundlePath).filter((c) => c.kind === 'change-request' && c.status === 'open' && !c.resolved)
}

/**
 * Shared shape behind every chain-walking function below: a round-1 bundle (no
 * `chain.json`) is the base case, otherwise resolve the previous round's bundle path
 * and hand it (plus the chain itself, for its `round` number) to `step`.
 */
function walkChain<T>(bundlePath: string, base: () => T, step: (previousBundlePath: string, chain: Chain) => T): T {
  const chain = readChain(bundlePath)
  return chain ? step(resolvePreviousBundlePath(bundlePath, chain), chain) : base()
}

/**
 * Copies every still-open change-request Comment from the previous round in the chain
 * into this round's own comment log, so it's visible and actionable here too. Idempotent
 * — safe to call every time a round-N bundle is opened, validated, or rendered.
 * No-ops for a round-1 bundle (no `chain.json`).
 */
export function carryForwardChain(bundlePath: string): void {
  walkChain(
    bundlePath,
    () => undefined,
    (previousBundlePath) => {
      for (const comment of openChangeRequests(previousBundlePath)) {
        carryForwardComment(bundlePath, comment)
      }
    },
  )
}

export interface CarriedResolution {
  comment: Comment
  resolution: Resolution
}

/**
 * Evaluates every comment carried forward from the previous round against this round's
 * incremental patch. Assumes `carryForwardChain` has already copied them into this
 * round's own log — this only reads, never writes.
 */
export function computeCarriedResolutions(bundlePath: string): CarriedResolution[] {
  return walkChain(
    bundlePath,
    () => [],
    (previousBundlePath) => {
      const carriedIds = new Set(openChangeRequests(previousBundlePath).map((c) => c.id))
      if (carriedIds.size === 0) return []

      const previousPatch = readPatch(previousBundlePath)
      const currentPatch = readPatch(bundlePath)
      return readQuestions(bundlePath)
        .filter((c) => carriedIds.has(c.id))
        .map((comment) => ({ comment, resolution: evaluateResolution(comment, previousPatch, currentPatch) }))
    },
  )
}

function findOriginRound(bundlePath: string, commentId: string): number {
  return walkChain(
    bundlePath,
    () => 1,
    (previousBundlePath, chain) => {
      const inPreviousRound = readQuestions(previousBundlePath).some((c) => c.id === commentId)
      return inPreviousRound ? findOriginRound(previousBundlePath, commentId) : chain.round
    },
  )
}

export interface CommentView extends Comment {
  /** The round this comment was first raised in — 1 for a comment raised on the original bundle. */
  originRound: number
  /** Present only for a comment carried forward from the previous round and still open. */
  resolution?: Resolution
}

/**
 * The full comment history for this bundle: its own log, plus every ancestor round's
 * comments not already present here (own log id, e.g. a resolved-in-round-1 change
 * request never carried forward as open). Resolved comments are never dropped — they
 * simply keep showing from whichever round's log actually holds them (framework.md's
 * "never silently discard evidence").
 */
export function collectCommentHistory(bundlePath: string): Array<Comment & { originRound: number }> {
  const own = readQuestions(bundlePath).map((c) => ({ ...c, originRound: findOriginRound(bundlePath, c.id) }))
  return walkChain(
    bundlePath,
    () => own,
    (previousBundlePath) => {
      const ownIds = new Set(own.map((c) => c.id))
      const ancestorHistory = collectCommentHistory(previousBundlePath).filter((c) => !ownIds.has(c.id))
      return [...own, ...ancestorHistory].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
  )
}

/** Every Comment relevant to this bundle, with its claimed Resolution attached where one applies. */
export function listComments(bundlePath: string): CommentView[] {
  const resolutions = new Map(computeCarriedResolutions(bundlePath).map((c) => [c.comment.id, c.resolution]))
  return collectCommentHistory(bundlePath).map((comment) => ({ ...comment, resolution: resolutions.get(comment.id) }))
}

function targetKey(target: Target): string {
  switch (target.type) {
    case 'file':
      return `file:${target.path}`
    case 'binary':
      return `binary:${target.path}`
    case 'hunk':
      return `hunk:${target.path}:${target.hunkIndex}`
    case 'line':
      return `line:${target.path}:${target.side}:${target.line}`
  }
}

export interface CarriedReviewContent {
  behavioralGroups: BehavioralGroup[]
  annotations: Annotation[]
}

/**
 * Behavioral Groups/Annotations carried forward from earlier rounds for material the
 * incremental patch doesn't touch — the round-N Generator is only expected to write
 * fresh ones for genuinely new material (framework.md's "slim rounds"). Recurses the
 * whole chain so a group/annotation keeps surfacing across every later round until a
 * round's incremental patch actually touches its file, or a later round redeclares it.
 */
export function collectCarriedReviewContent(bundlePath: string, ownDocument: ReviewDocument): CarriedReviewContent {
  return walkChain(
    bundlePath,
    () => ({ behavioralGroups: [], annotations: [] }),
    (previousBundlePath) => {
      const previousDocument = readReviewDocument(previousBundlePath)
      const previousCarried = collectCarriedReviewContent(previousBundlePath, previousDocument)
      const previousAll: CarriedReviewContent = {
        behavioralGroups: [...(previousDocument.behavioralGroups ?? []), ...previousCarried.behavioralGroups],
        annotations: [...(previousDocument.annotations ?? []), ...previousCarried.annotations],
      }

      const touchedPaths = incrementalTouchedPaths(readPatch(previousBundlePath), readPatch(bundlePath))
      const ownTargetKeys = new Set((ownDocument.annotations ?? []).map((a) => targetKey(a.target)))
      const ownGroupIds = new Set((ownDocument.behavioralGroups ?? []).map((g) => g.id))

      return {
        annotations: previousAll.annotations.filter((a) => !touchedPaths.has(a.target.path) && !ownTargetKeys.has(targetKey(a.target))),
        behavioralGroups: previousAll.behavioralGroups.filter(
          (g) => !ownGroupIds.has(g.id) && !(g.targets ?? []).some((t) => touchedPaths.has(t.path)),
        ),
      }
    },
  )
}
