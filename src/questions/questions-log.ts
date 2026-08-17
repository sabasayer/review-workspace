import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { Target } from '../schema/types.ts'
import type { Comment, CommentLogEntry } from './types.ts'

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

/** Raises a new, immutable question Comment. Never mutates or removes any existing log entry. */
export function raiseQuestion(bundlePath: string, body: string, target?: Target): Comment {
  const entry: CommentLogEntry = {
    type: 'raised',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    body,
    target,
    kind: 'question',
  }
  appendEntry(bundlePath, entry)
  return { id: entry.id, createdAt: entry.createdAt, body: entry.body, target: entry.target, kind: 'question', status: 'open' }
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
    },
  }
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
      })
    } else {
      const comment = comments.get(entry.questionId)
      if (comment) {
        comment.status = 'withdrawn'
        comment.supersededBy = entry.replacementId
      }
    }
  }
  return [...comments.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
