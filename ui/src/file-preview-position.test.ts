import { describe, expect, it } from 'vitest'
import { placePopover } from './file-preview-position.ts'

const viewport = { width: 1000, height: 800 }

describe('placePopover', () => {
  it('opens below the name when there is room', () => {
    expect(placePopover({ left: 100, top: 100, bottom: 120 }, viewport, 400)).toEqual({ left: 100, top: 126 })
  })

  it('opens above the name when the room below is small and the room above is larger', () => {
    expect(placePopover({ left: 100, top: 600, bottom: 620 }, viewport, 400)).toEqual({ left: 100, bottom: 206 })
  })

  it('stays below when both sides are small but below is larger', () => {
    expect(placePopover({ left: 100, top: 100, bottom: 700 }, { width: 1000, height: 800 }, 400)).toEqual({ left: 100, top: 706 })
  })

  it('keeps the popover inside the window on the right and on the left', () => {
    expect(placePopover({ left: 900, top: 100, bottom: 120 }, viewport, 400).left).toBe(592)
    expect(placePopover({ left: -50, top: 100, bottom: 120 }, viewport, 400).left).toBe(8)
  })
})
