import { describe, expect, it } from 'vitest'
import { parseCommentTarget } from './comment-target.ts'

describe('parseCommentTarget', () => {
  it('accepts a missing Target', () => {
    expect(parseCommentTarget(undefined)).toEqual({ ok: true, target: undefined })
  })

  it('accepts the general Target', () => {
    expect(parseCommentTarget({ type: 'general' })).toEqual({ ok: true, target: { type: 'general' } })
  })

  it.each([
    [{ type: 'file', path: 'a.ts' }],
    [{ type: 'binary', path: 'a.png' }],
    [{ type: 'hunk', path: 'a.ts', hunkIndex: 0 }],
    [{ type: 'line', path: 'a.ts', side: 'head', line: 3, expectedText: 'x' }],
  ])('accepts the code Target %j', (target) => {
    expect(parseCommentTarget(target)).toEqual({ ok: true, target })
  })

  it('drops extra fields from the general Target', () => {
    expect(parseCommentTarget({ type: 'general', path: 'a.ts' })).toEqual({ ok: true, target: { type: 'general' } })
  })

  it.each([
    ['text'],
    [null],
    [{ type: 'nope' }],
    [{ type: 'file' }],
    [{ type: 'hunk', path: 'a.ts', hunkIndex: -1 }],
    [{ type: 'line', path: 'a.ts', side: 'middle', line: 3, expectedText: 'x' }],
    [{ type: 'line', path: 'a.ts', side: 'head', line: 0, expectedText: 'x' }],
  ])('rejects %j', (target) => {
    expect(parseCommentTarget(target)).toMatchObject({ ok: false, error: expect.stringContaining('target') })
  })
})
