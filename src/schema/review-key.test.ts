import { describe, expect, it } from 'vitest'
import { reviewKey } from './review-key.ts'

describe('reviewKey', () => {
  it('uses the MR number when there is one', () => {
    expect(reviewKey({ base: 'a', head: 'b', number: '42', sourceBranch: 'feat/x' })).toBe('42')
  })

  it('uses the source branch, safe for a file name, for a local branch', () => {
    expect(reviewKey({ base: 'a', head: 'b', sourceBranch: 'feat/fix login' })).toBe('feat-fix-login')
  })

  it('has no key without a number or a source branch', () => {
    expect(reviewKey({ base: 'a', head: 'b' })).toBeUndefined()
  })
})
