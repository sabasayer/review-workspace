import { describe, expect, it } from 'vitest'
import { commentBadgeClasses, commentGlyph } from './comment-style.ts'
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
