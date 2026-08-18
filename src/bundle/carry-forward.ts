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

/**
 * `chain.json`, `changes.diff`, and (for an ancestor bundle) `review.json` are all
 * bundle inputs a caller might otherwise re-read and re-parse once per ancestor per
 * function — `render()`, `computeCarriedResolutions`, `collectCommentHistory`, and
 * `collectCarriedReviewContent` all walk the same chain. A `Caches` instance memoizes
 * those reads by bundlePath for the lifetime of a single top-level call.
 *
 * Deliberately NOT a module-level singleton: a round's `review.json` can legitimately
 * change after this process first reads it (the "Improve" workflow republishes a
 * bundle without changing its base/head, including one that's since become an
 * ancestor in a longer-running server's chain). A cache instance is created fresh by
 * each exported entry point below and discarded when that call returns, so a later
 * call always sees whatever is on disk now rather than whatever some earlier call saw.
 */
export interface Caches {
  chain: Map<string, Chain | undefined>
  patch: Map<string, ParsedPatch>
  reviewDocument: Map<string, ReviewDocument>
}

export function createCaches(): Caches {
  return { chain: new Map(), patch: new Map(), reviewDocument: new Map() }
}

export function readChain(bundlePath: string, caches: Caches = createCaches()): Chain | undefined {
  if (!caches.chain.has(bundlePath)) {
    const path = join(bundlePath, 'chain.json')
    caches.chain.set(bundlePath, existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as Chain) : undefined)
  }
  return caches.chain.get(bundlePath)
}

export function resolvePreviousBundlePath(bundlePath: string, chain: Chain): string {
  return resolve(bundlePath, chain.previousBundle)
}

function readPatch(bundlePath: string, caches: Caches): ParsedPatch {
  if (!caches.patch.has(bundlePath)) {
    caches.patch.set(bundlePath, parsePatch(readFileSync(join(bundlePath, 'changes.diff'), 'utf-8')))
  }
  return caches.patch.get(bundlePath)!
}

function readReviewDocument(bundlePath: string, caches: Caches): ReviewDocument {
  if (!caches.reviewDocument.has(bundlePath)) {
    caches.reviewDocument.set(bundlePath, JSON.parse(readFileSync(join(bundlePath, 'review.json'), 'utf-8')) as ReviewDocument)
  }
  return caches.reviewDocument.get(bundlePath)!
}

function openChangeRequests(bundlePath: string): Comment[] {
  return readQuestions(bundlePath).filter((c) => c.kind === 'change-request' && c.status === 'open' && !c.resolved)
}

/**
 * Shared shape behind every chain-walking function below: a round-1 bundle (no
 * `chain.json`) is the base case, otherwise resolve the previous round's bundle path
 * and hand it (plus the chain itself, for its `round` number) to `step`.
 */
function walkChain<T>(bundlePath: string, caches: Caches, base: () => T, step: (previousBundlePath: string, chain: Chain) => T): T {
  const chain = readChain(bundlePath, caches)
  return chain ? step(resolvePreviousBundlePath(bundlePath, chain), chain) : base()
}

/**
 * Copies every still-open change-request Comment from the previous round in the chain
 * into this round's own comment log, so it's visible and actionable here too. Idempotent
 * — safe to call every time a round-N bundle is opened, validated, or rendered.
 * No-ops for a round-1 bundle (no `chain.json`).
 */
export function carryForwardChain(bundlePath: string, caches: Caches = createCaches()): void {
  walkChain(
    bundlePath,
    caches,
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
export function computeCarriedResolutions(bundlePath: string, caches: Caches = createCaches()): CarriedResolution[] {
  return walkChain(
    bundlePath,
    caches,
    () => [],
    (previousBundlePath) => {
      const carriedIds = new Set(openChangeRequests(previousBundlePath).map((c) => c.id))
      if (carriedIds.size === 0) return []

      const previousPatch = readPatch(previousBundlePath, caches)
      const currentPatch = readPatch(bundlePath, caches)
      return readQuestions(bundlePath)
        .filter((c) => carriedIds.has(c.id))
        .map((comment) => ({ comment, resolution: evaluateResolution(comment, previousPatch, currentPatch) }))
    },
  )
}

function findOriginRound(bundlePath: string, commentId: string, caches: Caches): number {
  return walkChain(
    bundlePath,
    caches,
    () => 1,
    (previousBundlePath, chain) => {
      const inPreviousRound = readQuestions(previousBundlePath).some((c) => c.id === commentId)
      return inPreviousRound ? findOriginRound(previousBundlePath, commentId, caches) : chain.round
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
export function collectCommentHistory(bundlePath: string, caches: Caches = createCaches()): Array<Comment & { originRound: number }> {
  const own = readQuestions(bundlePath).map((c) => ({ ...c, originRound: findOriginRound(bundlePath, c.id, caches) }))
  return walkChain(
    bundlePath,
    caches,
    () => own,
    (previousBundlePath) => {
      const ownIds = new Set(own.map((c) => c.id))
      const ancestorHistory = collectCommentHistory(previousBundlePath, caches).filter((c) => !ownIds.has(c.id))
      return [...own, ...ancestorHistory].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
  )
}

/** Every Comment relevant to this bundle, with its claimed Resolution attached where one applies. */
export function listComments(bundlePath: string, caches: Caches = createCaches()): CommentView[] {
  const resolutions = new Map(computeCarriedResolutions(bundlePath, caches).map((c) => [c.comment.id, c.resolution]))
  return collectCommentHistory(bundlePath, caches).map((comment) => ({ ...comment, resolution: resolutions.get(comment.id) }))
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
export function collectCarriedReviewContent(
  bundlePath: string,
  ownDocument: ReviewDocument,
  caches: Caches = createCaches(),
): CarriedReviewContent {
  return walkChain(
    bundlePath,
    caches,
    () => ({ behavioralGroups: [], annotations: [] }),
    (previousBundlePath) => {
      const previousDocument = readReviewDocument(previousBundlePath, caches)
      const previousCarried = collectCarriedReviewContent(previousBundlePath, previousDocument, caches)
      const previousAll: CarriedReviewContent = {
        behavioralGroups: [...(previousDocument.behavioralGroups ?? []), ...previousCarried.behavioralGroups],
        annotations: [...(previousDocument.annotations ?? []), ...previousCarried.annotations],
      }

      const touchedPaths = incrementalTouchedPaths(readPatch(previousBundlePath, caches), readPatch(bundlePath, caches))
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
