import { describe, expect, it } from 'vitest'
import { imageSizing } from './image-sizing.ts'

describe('imageSizing', () => {
  it('keeps inline images small and zoomable', () => {
    const sizing = imageSizing(false)
    expect(sizing.pane).toContain('max-w-md')
    expect(sizing.cursor).toBe('cursor-zoom-in')
  })

  it('fits large images to the window height and drops the zoom cursor', () => {
    const sizing = imageSizing(true)
    expect(sizing.paneImage).toContain('max-h-[70vh]')
    expect(sizing.stageImage).toContain('max-h-[70vh]')
    expect(sizing.cursor).toBe('')
  })
})
