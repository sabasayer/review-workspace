import { describe, expect, it } from 'vitest'
import { formatHeaderTitle, hasMrMetadata, renderComparisonDescription } from './comparison-header.ts'

describe('comparison-header', () => {
  it('detects when MR metadata is present', () => {
    expect(hasMrMetadata(undefined)).toBe(false)
    expect(hasMrMetadata({ base: 'a', head: 'b' })).toBe(false)
    expect(hasMrMetadata({ base: 'a', head: 'b', title: 'Fix login' })).toBe(true)
  })

  it('formats header titles', () => {
    expect(formatHeaderTitle(undefined)).toBe('Review Workspace')
    expect(formatHeaderTitle({ base: 'a', head: 'b', title: 'Fix login', number: '42' })).toBe('!42 Fix login')
    expect(formatHeaderTitle({ base: 'a', head: 'b' })).toBe('a → b')
  })

  it('renders markdown descriptions', () => {
    expect(renderComparisonDescription(undefined)).toBe('')
    expect(renderComparisonDescription({ base: 'a', head: 'b', description: '**bold**' })).toContain('<strong>bold</strong>')
  })
})
