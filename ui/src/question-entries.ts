import { nextTick } from 'vue'
import { anchorId, lineAnchorId } from './diff-layout.ts'
import { expandHunk } from './composables/expanded-hunks-store.ts'
import type { Answer, Question, RenderedFile, Target } from './types.ts'

export interface QuestionEntry {
  question: Question
  answer: Answer | undefined
  filePath?: string
  hunkIndex?: number
  lineId?: string
}

export function resolveQuestionEntries(
  files: RenderedFile[],
  answers: Answer[],
  questions: readonly Question[],
): QuestionEntry[] {
  return questions.map((question): QuestionEntry => {
    const answer = answers.find((a) => a.questionId === question.id)
    const target = question.target
    if (!target) return { question, answer }
    const file = files.find((f) => f.path === target.path)
    if (!file) return { question, answer, filePath: target.path }
    if (target.type === 'line') {
      for (let hunkIndex = 0; hunkIndex < file.hunks.length; hunkIndex++) {
        const line = file.hunks[hunkIndex].lines.find((l) =>
          target.side === 'base' ? l.oldLine === target.line : l.newLine === target.line,
        )
        if (line) return { question, answer, filePath: file.path, hunkIndex, lineId: line.id }
      }
    }
    return { question, answer, filePath: file.path }
  })
}

export function countOpenQuestions(entries: QuestionEntry[]): number {
  return entries.filter((e) => {
    if (e.question.status !== 'open') return false
    return e.question.kind === 'change-request' ? !e.question.resolved : !e.answer
  }).length
}

export async function scrollToQuestionTarget(entry: QuestionEntry): Promise<void> {
  if (!entry.filePath) return
  if (entry.hunkIndex !== undefined) expandHunk(entry.filePath, entry.hunkIndex)
  await nextTick()
  const id = entry.lineId ? lineAnchorId(entry.lineId) : anchorId(entry.filePath)
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export async function scrollToLineInFile(filePath: string, hunkIndex: number, lineId: string): Promise<void> {
  expandHunk(filePath, hunkIndex)
  await nextTick()
  document.getElementById(lineAnchorId(lineId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function buildLineTarget(filePath: string, text: string, oldLine?: number, newLine?: number): Target {
  return newLine !== undefined
    ? { type: 'line', path: filePath, side: 'head', line: newLine, expectedText: text }
    : { type: 'line', path: filePath, side: 'base', line: oldLine!, expectedText: text }
}

export function questionsForFile(questions: readonly Question[], filePath: string): Question[] {
  return questions.filter((q) => q.target?.path === filePath)
}

export function fileLevelQuestions(questions: readonly Question[], filePath: string): Question[] {
  return questionsForFile(questions, filePath).filter((q) => q.target?.type !== 'line')
}

export function questionsForLine(
  questions: readonly Question[],
  filePath: string,
  side: 'base' | 'head',
  line?: number,
): Question[] {
  if (line === undefined) return []
  return questionsForFile(questions, filePath).filter(
    (q) => q.target?.type === 'line' && q.target.side === side && q.target.line === line,
  )
}
