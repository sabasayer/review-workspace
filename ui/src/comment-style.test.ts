import { describe, expect, it } from 'vitest'
import {
  commentBadgeClasses,
  commentGlyph,
  commentKindColor,
  commentKindLabel,
  commentStatusColor,
  commentStatusLabel,
} from './comment-style.ts'
import type { Question } from './types.ts'

function comment(overrides: Partial<Question>): Question {
  return { id: 'c1', createdAt: 't', body: 'body', kind: 'question', status: 'open', resolved: false, ...overrides }
}

describe('commentGlyph', () => {
  it('renders a question mark for a question', () => {
    expect(commentGlyph(comment({ kind: 'question' }))).toBe('?')
  })

  it('renders an exclamation mark for an open change-request', () => {
    expect(commentGlyph(comment({ kind: 'change-request', resolved: false }))).toBe('!')
  })

  it('renders a checkmark for a resolved change-request', () => {
    expect(commentGlyph(comment({ kind: 'change-request', resolved: true, resolvedAt: 't2' }))).toBe('✓')
  })
})

describe('commentBadgeClasses', () => {
  it('uses info styling for an open question', () => {
    expect(commentBadgeClasses(comment({ kind: 'question', status: 'open' }))).toContain('text-info')
  })

  it('uses dimmed strikethrough styling for a withdrawn comment regardless of kind', () => {
    expect(commentBadgeClasses(comment({ kind: 'change-request', status: 'withdrawn' }))).toContain('line-through')
  })

  it('uses error styling for an open, unresolved change-request', () => {
    const classes = commentBadgeClasses(comment({ kind: 'change-request', status: 'open', resolved: false }))
    expect(classes).toContain('text-error')
  })

  it('uses success styling for a resolved change-request', () => {
    const classes = commentBadgeClasses(comment({ kind: 'change-request', status: 'open', resolved: true, resolvedAt: 't2' }))
    expect(classes).toContain('text-success')
  })
})

describe('commentKindColor', () => {
  it('is error for a change-request', () => {
    expect(commentKindColor(comment({ kind: 'change-request' }))).toBe('error')
  })

  it('is info for a question', () => {
    expect(commentKindColor(comment({ kind: 'question' }))).toBe('info')
  })
})

describe('commentKindLabel', () => {
  it('labels a change-request', () => {
    expect(commentKindLabel(comment({ kind: 'change-request' }))).toBe('Change request')
  })

  it('labels a question', () => {
    expect(commentKindLabel(comment({ kind: 'question' }))).toBe('Question')
  })
})

describe('commentStatusColor', () => {
  it('is warning for an open, unresolved comment', () => {
    expect(commentStatusColor(comment({ status: 'open', resolved: false }))).toBe('warning')
  })

  it('is neutral for a withdrawn comment', () => {
    expect(commentStatusColor(comment({ status: 'withdrawn', resolved: false }))).toBe('neutral')
  })

  it('is success for a resolved change-request', () => {
    expect(commentStatusColor(comment({ kind: 'change-request', status: 'open', resolved: true, resolvedAt: 't2' }))).toBe('success')
  })

  it('is success for an answered question when hasAnswer is passed', () => {
    expect(commentStatusColor(comment({ kind: 'question', status: 'open', resolved: false }), true)).toBe('success')
  })

  it('ignores hasAnswer once a comment is resolved', () => {
    expect(commentStatusColor(comment({ kind: 'change-request', status: 'open', resolved: true }), false)).toBe('success')
  })
})

describe('commentStatusLabel', () => {
  it('labels an open comment', () => {
    expect(commentStatusLabel(comment({ status: 'open', resolved: false }))).toBe('Open')
  })

  it('labels a withdrawn comment', () => {
    expect(commentStatusLabel(comment({ status: 'withdrawn', resolved: false }))).toBe('Withdrawn')
  })

  it('labels a resolved change-request', () => {
    expect(commentStatusLabel(comment({ kind: 'change-request', status: 'open', resolved: true, resolvedAt: 't2' }))).toBe('Resolved')
  })

  it('labels an answered question as Answered when hasAnswer is passed', () => {
    expect(commentStatusLabel(comment({ kind: 'question', status: 'open', resolved: false }), true)).toBe('Answered')
  })

  it('prefers Resolved over Answered when both are true', () => {
    expect(commentStatusLabel(comment({ kind: 'change-request', status: 'open', resolved: true }), true)).toBe('Resolved')
  })
})
