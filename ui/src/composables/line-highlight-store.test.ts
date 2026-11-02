import { beforeEach, describe, expect, it } from 'vitest'
import { isLineHighlighted, setHoveredLines, setNoteOpen } from './line-highlight-store.ts'

beforeEach(() => {
  setHoveredLines([])
  setNoteOpen('n1', [], false)
  setNoteOpen('n2', [], false)
})

describe('line highlight store', () => {
  it('highlights every hovered line and clears them', () => {
    setHoveredLines(['l1', 'l2'])
    expect(isLineHighlighted('l1')).toBe(true)
    expect(isLineHighlighted('l2')).toBe(true)
    expect(isLineHighlighted('l3')).toBe(false)
    setHoveredLines([])
    expect(isLineHighlighted('l1')).toBe(false)
  })

  it('keeps the lines of an open note highlighted until it closes', () => {
    setNoteOpen('n1', ['l1'], true)
    setNoteOpen('n2', ['l2'], true)
    expect(isLineHighlighted('l1')).toBe(true)
    setNoteOpen('n1', ['l1'], false)
    expect(isLineHighlighted('l1')).toBe(false)
    expect(isLineHighlighted('l2')).toBe(true)
  })
})
