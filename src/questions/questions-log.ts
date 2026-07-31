import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { Target } from '../schema/types.ts'
import type { Question, QuestionLogEntry } from './types.ts'

function logPath(bundlePath: string): string {
  return join(bundlePath, 'questions.jsonl')
}

function readLog(bundlePath: string): QuestionLogEntry[] {
  const path = logPath(bundlePath)
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as QuestionLogEntry)
}

function appendEntry(bundlePath: string, entry: QuestionLogEntry): void {
  appendFileSync(logPath(bundlePath), JSON.stringify(entry) + '\n')
}

/** Raises a new, immutable Question. Never mutates or removes any existing log entry. */
export function raiseQuestion(bundlePath: string, body: string, target?: Target): Question {
  const entry: QuestionLogEntry = { type: 'raised', id: randomUUID(), createdAt: new Date().toISOString(), body, target }
  appendEntry(bundlePath, entry)
  return { id: entry.id, createdAt: entry.createdAt, body: entry.body, target: entry.target, status: 'open' }
}

/**
 * Withdraws an existing Question and raises its replacement in one call — a
 * correction is recorded as new log entries, never as an edit to the original.
 */
export function withdrawAndReplaceQuestion(
  bundlePath: string,
  questionId: string,
  replacementBody: string,
  replacementTarget?: Target,
): { withdrawn: string; replacement: Question } {
  const replacement: QuestionLogEntry = {
    type: 'raised',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    body: replacementBody,
    target: replacementTarget,
  }
  const withdrawal: QuestionLogEntry = {
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
      status: 'open',
    },
  }
}

/** Reduces the append-only log into the current set of Questions. */
export function readQuestions(bundlePath: string): Question[] {
  const questions = new Map<string, Question>()
  for (const entry of readLog(bundlePath)) {
    if (entry.type === 'raised') {
      questions.set(entry.id, {
        id: entry.id,
        createdAt: entry.createdAt,
        body: entry.body,
        target: entry.target,
        status: 'open',
      })
    } else {
      const question = questions.get(entry.questionId)
      if (question) {
        question.status = 'withdrawn'
        question.supersededBy = entry.replacementId
      }
    }
  }
  return [...questions.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
