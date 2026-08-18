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

export function readChain(bundlePath: string): Chain | undefined {
  const path = join(bundlePath, 'chain.json')
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf-8')) as Chain
}

export function resolvePreviousBundlePath(bundlePath: string, chain: Chain): string {
  return resolve(bundlePath, chain.previousBundle)
}

function readPatch(bundlePath: string): ParsedPatch {
  return parsePatch(readFileSync(join(bundlePath, 'changes.diff'), 'utf-8'))
}

function readReviewDocument(bundlePath: string): ReviewDocument {
  return JSON.parse(readFileSync(join(bundlePath, 'review.json'), 'utf-8')) as ReviewDocument
}

function openChangeRequests(bundlePath: string): Comment[] {
  return readQuestions(bundlePath).filter((c) => c.kind === 'change-request' && c.status === 'open' && !c.resolved)
}

/**
 * Copies every still-open change-request Comment from the previous round in the chain
 * into this round's own comment log, so it's visible and actionable here too. Idempotent
 * — safe to call every time a round-N bundle is opened, validated, or rendered.
 * No-ops for a round-1 bundle (no `chain.json`).
 */
export function carryForwardChain(bundlePath: string): void {
  const chain = readChain(bundlePath)
  if (!chain) return
  const previousBundlePath = resolvePreviousBundlePath(bundlePath, chain)
  for (const comment of openChangeRequests(previousBundlePath)) {
    carryForwardComment(bundlePath, comment)
  }
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
  const chain = readChain(bundlePath)
  if (!chain) return []
  const previousBundlePath = resolvePreviousBundlePath(bundlePath, chain)
  const carriedIds = new Set(openChangeRequests(previousBundlePath).map((c) => c.id))
  if (carriedIds.size === 0) return []

  const previousPatch = readPatch(previousBundlePath)
  const currentPatch = readPatch(bundlePath)
  return readQuestions(bundlePath)
    .filter((c) => carriedIds.has(c.id))
    .map((comment) => ({ comment, resolution: evaluateResolution(comment, previousPatch, currentPatch) }))
}

function findOriginRound(bundlePath: string, commentId: string): number {
  const chain = readChain(bundlePath)
  const own = chain?.round ?? 1
  if (!chain) return own
  const previousBundlePath = resolvePreviousBundlePath(bundlePath, chain)
  const inPreviousRound = readQuestions(previousBundlePath).some((c) => c.id === commentId)
  return inPreviousRound ? findOriginRound(previousBundlePath, commentId) : own
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
  const chain = readChain(bundlePath)
  if (!chain) return own

  const ownIds = new Set(own.map((c) => c.id))
  const previousBundlePath = resolvePreviousBundlePath(bundlePath, chain)
  const ancestorHistory = collectCommentHistory(previousBundlePath).filter((c) => !ownIds.has(c.id))
  return [...own, ...ancestorHistory].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
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
  const chain = readChain(bundlePath)
  if (!chain) return { behavioralGroups: [], annotations: [] }

  const previousBundlePath = resolvePreviousBundlePath(bundlePath, chain)
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
}
