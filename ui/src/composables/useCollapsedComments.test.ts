import { describe, expect, it } from 'vitest'
import { useCollapsedComments } from './useCollapsedComments.ts'

describe('useCollapsedComments', () => {
  it('collapses a resolved comment by default', () => {
    const { isCollapsed } = useCollapsedComments()
    expect(isCollapsed({ id: 'c1', resolved: true })).toBe(true)
  })

  it('never collapses an unresolved comment', () => {
    const { isCollapsed, toggleExpanded } = useCollapsedComments()
    expect(isCollapsed({ id: 'c1', resolved: false })).toBe(false)
    toggleExpanded('c1')
    expect(isCollapsed({ id: 'c1', resolved: false })).toBe(false)
  })

  it('expands a resolved comment after toggling', () => {
    const { isCollapsed, toggleExpanded } = useCollapsedComments()
    toggleExpanded('c1')
    expect(isCollapsed({ id: 'c1', resolved: true })).toBe(false)
  })

  it('re-collapses a resolved comment after toggling twice', () => {
    const { isCollapsed, toggleExpanded } = useCollapsedComments()
    toggleExpanded('c1')
    toggleExpanded('c1')
    expect(isCollapsed({ id: 'c1', resolved: true })).toBe(true)
  })

  it('tracks expansion independently per comment id', () => {
    const { isCollapsed, toggleExpanded } = useCollapsedComments()
    toggleExpanded('c1')
    expect(isCollapsed({ id: 'c1', resolved: true })).toBe(false)
    expect(isCollapsed({ id: 'c2', resolved: true })).toBe(true)
  })
})
