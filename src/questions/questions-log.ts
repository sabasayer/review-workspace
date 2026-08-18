import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { Target } from '../schema/types.ts'
import type { Comment, CommentKind, CommentLogEntry } from './types.ts'

// File name predates the Comment/kind split (it only ever held Questions) — kept
// as-is so bundles created before this change keep reading correctly; only the
// in-memory shape gained `kind`, not the on-disk path.
function logPath(bundlePath: string): string {
  return join(bundlePath, 'questions.jsonl')
}

function readLog(bundlePath: string): CommentLogEntry[] {
  const path = logPath(bundlePath)
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CommentLogEntry)
}

function appendEntry(bundlePath: string, entry: CommentLogEntry): void {
  appendFileSync(logPath(bundlePath), JSON.stringify(entry) + '\n')
}

/** Raises a new, immutable Comment. Never mutates or removes any existing log entry. */
export function raiseQuestion(bundlePath: string, body: string, target?: Target, kind: CommentKind = 'question'): Comment {
  const entry: CommentLogEntry = {
    type: 'raised',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    body,
    target,
    kind,
  }
  appendEntry(bundlePath, entry)
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    body: entry.body,
    target: entry.target,
    kind,
    status: 'open',
    resolved: false,
  }
}

/**
 * Withdraws an existing question Comment and raises its replacement in one call —
 * a correction is recorded as new log entries, never as an edit to the original.
 */
export function withdrawAndReplaceQuestion(
  bundlePath: string,
  questionId: string,
  replacementBody: string,
  replacementTarget?: Target,
): { withdrawn: string; replacement: Comment } {
  const replacement: CommentLogEntry = {
    type: 'raised',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    body: replacementBody,
    target: replacementTarget,
    kind: 'question',
  }
  const withdrawal: CommentLogEntry = {
    type: 'withdrawn',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    questionId,
    replacementId: replacement.id,
  }
  appendEntry(bundlePath, withdrawal)
  appendEntry(bundlePath, replacement)
  return {
    withdrawn: questionId,
    replacement: {
      id: replacement.id,
      createdAt: replacement.createdAt,
      body: replacement.body,
      target: replacement.target,
      kind: 'question',
      status: 'open',
      resolved: false,
    },
  }
}

export type ResolveCommentResult =
  | { outcome: 'resolved'; comment: Comment }
  | { outcome: 'not-found' }
  | { outcome: 'not-resolvable'; comment: Comment }

function isOpenChangeRequest(comment: Comment): boolean {
  return comment.kind === 'change-request' && comment.status === 'open' && !comment.resolved
}

/**
 * Marks an open change-request Comment resolved. This is a human-only, reviewer-triggered
 * action recorded in the same append-only log — nothing a Generator writes (the
 * Review Document, `review.next.json`) can ever produce this entry.
 *
 * Validates before writing: a Comment that doesn't exist, or isn't currently an open
 * change-request, is rejected without appending anything to the log.
 */
export function resolveComment(bundlePath: string, commentId: string): ResolveCommentResult {
  const comment = readQuestions(bundlePath).find((c) => c.id === commentId)
  if (!comment) return { outcome: 'not-found' }
  if (!isOpenChangeRequest(comment)) return { outcome: 'not-resolvable', comment }

  const entry: CommentLogEntry = {
    type: 'resolved',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    commentId,
  }
  appendEntry(bundlePath, entry)
  return {
    outcome: 'resolved',
    comment: { ...comment, resolved: true, resolvedAt: entry.createdAt },
  }
}

/**
 * Copies a still-open change-request Comment from an earlier round's log into this
 * round's own log, preserving its id and original createdAt so a Reviewer can act on it
 * (resolve it) directly from this round. No-ops if this round's log already has a
 * `raised` entry for that id — safe to call on every bundle open/validate/render.
 */
export function carryForwardComment(bundlePath: string, comment: Comment): void {
  const alreadyCarried = readLog(bundlePath).some((entry) => entry.type === 'raised' && entry.id === comment.id)
  if (alreadyCarried) return
  appendEntry(bundlePath, {
    type: 'raised',
    id: comment.id,
    createdAt: comment.createdAt,
    body: comment.body,
    target: comment.target,
    kind: comment.kind,
  })
}

/** Reduces the append-only log into the current set of Comments. */
export function readQuestions(bundlePath: string): Comment[] {
  const comments = new Map<string, Comment>()
  for (const entry of readLog(bundlePath)) {
    if (entry.type === 'raised') {
      comments.set(entry.id, {
        id: entry.id,
        createdAt: entry.createdAt,
        body: entry.body,
        target: entry.target,
        kind: entry.kind ?? 'question',
        status: 'open',
        resolved: false,
      })
    } else if (entry.type === 'withdrawn') {
      const comment = comments.get(entry.questionId)
      if (comment) {
        comment.status = 'withdrawn'
        comment.supersededBy = entry.replacementId
      }
    } else {
      const comment = comments.get(entry.commentId)
      if (comment && comment.kind === 'change-request') {
        comment.resolved = true
        comment.resolvedAt = entry.createdAt
      }
    }
  }
  return [...comments.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
