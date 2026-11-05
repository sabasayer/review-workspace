import { isWatcherStale } from './bundle-status.ts'
import { countOpenChangeRequests, countOpenQuestions, type QuestionEntry } from './question-entries.ts'
import type { Question, Target, WatcherRead } from './types.ts'

export type ThreadState = 'waiting' | 'answering' | 'answered'

export function threadState(question: Question, answered: boolean, watcher: WatcherRead | null, now: Date = new Date()): ThreadState | null {
  if (question.kind !== 'question' || question.status !== 'open') return null
  if (answered) return 'answered'
  const answeringNow = watcher?.status === 'ok' && watcher.watcher.current === question.id && !isWatcherStale(watcher, now)
  return answeringNow ? 'answering' : 'waiting'
}

const STATE_BADGES: Record<ThreadState, { label: string; icon: string; color: 'neutral' | 'info' | 'success' }> = {
  waiting: { label: 'Waiting', icon: 'i-lucide-clock', color: 'neutral' },
  answering: { label: 'Answering', icon: 'i-lucide-loader-circle', color: 'info' },
  answered: { label: 'Answered', icon: 'i-lucide-circle-check', color: 'success' },
}

export function threadStateBadge(state: ThreadState) {
  return STATE_BADGES[state]
}

export function sortNewestFirst<T extends { question: Pick<Question, 'createdAt'> }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.question.createdAt.localeCompare(a.question.createdAt))
}

export function threadTargetLabel(target: Target | undefined): string {
  if (!target) return 'No target'
  switch (target.type) {
    case 'general':
      return 'Whole change'
    case 'hunk':
      return `${target.path} (hunk ${target.hunkIndex + 1})`
    case 'line':
      return `${target.path}:${target.line}`
    default:
      return target.path
  }
}

export function targetKey(target: Target | undefined): string {
  if (!target) return 'none'
  switch (target.type) {
    case 'general':
      return 'general'
    case 'hunk':
      return `hunk:${target.path}:${target.hunkIndex}`
    case 'line':
      return `line:${target.path}:${target.side}:${target.line}`
    default:
      return `${target.type}:${target.path}`
  }
}

export interface ComposerChoice {
  key: string
  label: string
  target: Target
}

const WHOLE_CHANGE: Target = { type: 'general' }

export function composerChoices(anchor: Target): ComposerChoice[] {
  const targets = [anchor, WHOLE_CHANGE]
  return targets
    .filter((target, i) => targets.findIndex((other) => targetKey(other) === targetKey(target)) === i)
    .map((target) => ({ key: targetKey(target), label: threadTargetLabel(target), target }))
}

export interface PanelBadge {
  text: string
  srText: string
  tone: 'new' | 'open'
}

export function panelBadge(newAnswers: number, openComments: number): PanelBadge | null {
  if (newAnswers > 0) {
    return { text: String(newAnswers), srText: `${newAnswers} new answer${newAnswers === 1 ? '' : 's'}`, tone: 'new' }
  }
  if (openComments > 0) return { text: String(openComments), srText: `${openComments} open`, tone: 'open' }
  return null
}

export type PanelTab = 'question' | 'change-request'

export function entriesForTab(entries: readonly QuestionEntry[], tab: PanelTab): QuestionEntry[] {
  return entries.filter((e) => e.question.kind === tab)
}

export function openCountForTab(entries: readonly QuestionEntry[], tab: PanelTab): number {
  const entriesOfTab = entriesForTab(entries, tab)
  return tab === 'question' ? countOpenQuestions(entriesOfTab) : countOpenChangeRequests(entriesOfTab)
}

const TAB_ORDER: readonly PanelTab[] = ['question', 'change-request']

const TAB_TEXT: Record<PanelTab, { label: string; emptyText: string }> = {
  question: { label: 'Questions', emptyText: 'No questions raised yet.' },
  'change-request': { label: 'Change-requests', emptyText: 'No change-requests raised yet.' },
}

export interface TabView {
  value: PanelTab
  label: string
  count: number
  emptyText: string
}

export function tabViews(entries: readonly QuestionEntry[]): TabView[] {
  return TAB_ORDER.map((value) => ({ value, ...TAB_TEXT[value], count: openCountForTab(entries, value) }))
}

export function nextTab(current: PanelTab, key: string): PanelTab | null {
  const index = TAB_ORDER.indexOf(current)
  switch (key) {
    case 'ArrowRight':
      return TAB_ORDER[(index + 1) % TAB_ORDER.length]!
    case 'ArrowLeft':
      return TAB_ORDER[(index - 1 + TAB_ORDER.length) % TAB_ORDER.length]!
    case 'Home':
      return TAB_ORDER[0]!
    case 'End':
      return TAB_ORDER[TAB_ORDER.length - 1]!
    default:
      return null
  }
}

export function tabId(tab: PanelTab): string {
  return `question-tab-${tab}`
}

export const TAB_PANEL_ID = 'question-tabpanel'
