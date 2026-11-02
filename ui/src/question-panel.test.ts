import { describe, expect, it } from 'vitest'
import {
  composerChoices,
  panelBadge,
  sortNewestFirst,
  targetKey,
  threadState,
  threadStateBadge,
  threadTargetLabel,
} from './question-panel.ts'
import type { Question, Target, WatcherRead } from './types.ts'

const question = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  createdAt: '2026-10-30T10:00:00.000Z',
  body: 'Why?',
  kind: 'question',
  status: 'open',
  resolved: false,
  originRound: 1,
  ...over,
})

const watcher = (current: string | null, over: Record<string, unknown> = {}): WatcherRead => ({
  status: 'ok',
  watcher: { enabled: true, cap: 20, used: 1, current, ...over },
})

describe('threadState', () => {
  it('is answered when an Answer exists, even while the watcher shows it as current', () => {
    expect(threadState(question(), true, watcher('q1'))).toBe('answered')
  })

  it('is answering while the watcher works on this Question', () => {
    expect(threadState(question(), false, watcher('q1'))).toBe('answering')
  })

  it('is waiting when nobody picked it up', () => {
    expect(threadState(question(), false, watcher(null))).toBe('waiting')
    expect(threadState(question(), false, watcher('other'))).toBe('waiting')
    expect(threadState(question(), false, { status: 'absent' })).toBe('waiting')
    expect(threadState(question(), false, null)).toBe('waiting')
  })

  it('has no agent state for a change-request', () => {
    expect(threadState(question({ kind: 'change-request' }), false, watcher('q1'))).toBeNull()
  })

  it('has no agent state for a withdrawn Question', () => {
    expect(threadState(question({ status: 'withdrawn' }), false, watcher(null))).toBeNull()
  })
})

describe('threadStateBadge', () => {
  it('gives every state a word and an icon', () => {
    for (const state of ['waiting', 'answering', 'answered'] as const) {
      const badge = threadStateBadge(state)
      expect(badge.label.toLowerCase()).toBe(state)
      expect(badge.icon).toMatch(/^i-lucide-/)
    }
  })

  it('gives each state its own icon, so colour is never the only cue', () => {
    const icons = (['waiting', 'answering', 'answered'] as const).map((s) => threadStateBadge(s).icon)
    expect(new Set(icons).size).toBe(3)
  })
})

describe('sortNewestFirst', () => {
  it('puts the newest Comment first without changing the input', () => {
    const entries = [
      { question: question({ id: 'a', createdAt: '2026-10-30T09:00:00.000Z' }) },
      { question: question({ id: 'c', createdAt: '2026-10-30T11:00:00.000Z' }) },
      { question: question({ id: 'b', createdAt: '2026-10-30T10:00:00.000Z' }) },
    ]
    expect(sortNewestFirst(entries).map((e) => e.question.id)).toEqual(['c', 'b', 'a'])
    expect(entries.map((e) => e.question.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('threadTargetLabel', () => {
  it('names the place a Comment is about', () => {
    expect(threadTargetLabel(undefined)).toBe('No target')
    expect(threadTargetLabel({ type: 'general' })).toBe('Whole change')
    expect(threadTargetLabel({ type: 'file', path: 'a.ts' })).toBe('a.ts')
    expect(threadTargetLabel({ type: 'hunk', path: 'a.ts', hunkIndex: 1 })).toBe('a.ts (hunk 2)')
    expect(threadTargetLabel({ type: 'line', path: 'a.ts', side: 'head', line: 4, expectedText: '' })).toBe('a.ts:4')
  })
})

describe('targetKey', () => {
  it('tells apart targets on the same file', () => {
    const line: Target = { type: 'line', path: 'a.ts', side: 'head', line: 4, expectedText: '' }
    expect(targetKey(line)).not.toBe(targetKey({ type: 'file', path: 'a.ts' }))
    expect(targetKey({ type: 'general' })).toBe('general')
    expect(targetKey(undefined)).toBe('none')
  })
})

describe('composerChoices', () => {
  const file: Target = { type: 'file', path: 'a.ts' }

  it('offers the anchor target first, then the whole change', () => {
    expect(composerChoices(file).map((c) => c.label)).toEqual(['a.ts', 'Whole change'])
  })

  it('does not list the whole change twice', () => {
    expect(composerChoices({ type: 'general' }).map((c) => c.label)).toEqual(['Whole change'])
  })

  it('carries the target for each choice', () => {
    expect(composerChoices(file)[0]).toEqual({ key: 'file:a.ts', label: 'a.ts', target: file })
  })
})

describe('panelBadge', () => {
  it('shows nothing when there is nothing to say', () => {
    expect(panelBadge(0, 0)).toBeNull()
  })

  it('counts new Answers first, with the word new for screen readers', () => {
    expect(panelBadge(2, 5)).toEqual({ text: '2', srText: '2 new answers', tone: 'new' })
    expect(panelBadge(1, 0)).toEqual({ text: '1', srText: '1 new answer', tone: 'new' })
  })

  it('falls back to the count of open Comments', () => {
    expect(panelBadge(0, 3)).toEqual({ text: '3', srText: '3 open', tone: 'open' })
  })
})
