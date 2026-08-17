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

/**
 * Marks a change-request Comment resolved. This is a human-only, reviewer-triggered
 * action recorded in the same append-only log — nothing a Generator writes (the
 * Review Document, `review.next.json`) can ever produce this entry. Resolving a
 * question Comment, or a Comment that doesn't exist, is a no-op: the entry is still
 * appended (the log stays append-only and honest about every action taken), but
 * `readQuestions`'s reduction only applies it to an existing change-request Comment.
 */
export function resolveComment(bundlePath: string, commentId: string): Comment | undefined {
  const entry: CommentLogEntry = {
    type: 'resolved',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    commentId,
  }
  appendEntry(bundlePath, entry)
  return readQuestions(bundlePath).find((comment) => comment.id === commentId)
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
