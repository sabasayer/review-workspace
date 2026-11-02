import { describe, expect, it } from 'vitest'
import { proofBackLinkLabel } from './proof-links.ts'

describe('proofBackLinkLabel', () => {
  it('names the file', () => {
    expect(proofBackLinkLabel({ evidenceId: 'e', path: 'a.vue' })).toBe('a.vue')
  })

  it('names the change in the file', () => {
    expect(proofBackLinkLabel({ evidenceId: 'e', path: 'a.vue', hunkIndex: 0 })).toBe('a.vue (change 1)')
  })
})
