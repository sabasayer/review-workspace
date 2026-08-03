import { describe, expect, it } from 'vitest'
import { diffImageData, grayImageData } from './image-pixel-diff.ts'

describe('diffImageData', () => {
  it('counts changed pixels above the threshold', () => {
    const base = grayImageData(2, 2, [0, 0, 0, 0])
    const head = grayImageData(2, 2, [0, 200, 0, 0])
    const out = grayImageData(2, 2, [0, 0, 0, 0])
    expect(diffImageData(base, head, out)).toEqual({ width: 2, height: 2, changedPercent: 25 })
  })

  it('reports zero changed pixels for identical images', () => {
    const pixels = grayImageData(2, 1, [10, 20])
    const out = grayImageData(2, 1, [0, 0])
    expect(diffImageData(pixels, pixels, out).changedPercent).toBe(0)
  })
})
