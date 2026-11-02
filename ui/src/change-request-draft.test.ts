import { describe, expect, it } from 'vitest'
import { changeRequestDraft, draftRows, questionDraft } from './change-request-draft.ts'

describe('changeRequestDraft', () => {
  it('starts with the suggestion', () => {
    expect(changeRequestDraft({ suggestion: 'Count only failed attempts.' })).toBe('Count only failed attempts.')
  })

  it('starts empty when the note has no suggestion', () => {
    expect(changeRequestDraft({})).toBe('')
  })
})

describe('draftRows', () => {
  it('gives a change-request a taller box', () => {
    expect(draftRows('change-request')).toBeGreaterThan(draftRows('question'))
  })
})

describe('questionDraft', () => {
  it('names the finding when the Question is about the whole change', () => {
    expect(questionDraft({ type: 'general' }, 'Missing changelog')).toBe('About "Missing changelog": ')
  })

  it('starts empty for a code Target, because the code is sent along', () => {
    expect(questionDraft({ type: 'file', path: 'a.ts' }, 'Missing changelog')).toBe('')
  })

  it('starts empty with no finding headline', () => {
    expect(questionDraft({ type: 'general' }, undefined)).toBe('')
  })
})
