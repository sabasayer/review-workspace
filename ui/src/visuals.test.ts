import { describe, expect, it } from 'vitest'
import { selectVisuals } from './visuals.ts'
import type { IntentVisual } from './types.ts'

const mr = (n: number): IntentVisual => ({ assetPath: `mr/${n}.png`, caption: `mr ${n}`, source: 'mr-text' })
const snap = (n: number): IntentVisual => ({ assetPath: `s/${n}.png`, baseAssetPath: `s/b${n}.png`, caption: `snap ${n}`, source: 'snapshot' })

describe('selectVisuals', () => {
  it('shows nothing when there are no visuals', () => {
    expect(selectVisuals(undefined)).toEqual({ shown: [], more: [] })
    expect(selectVisuals([])).toEqual({ shown: [], more: [] })
  })

  it('puts MR-text images before changed snapshots', () => {
    const { shown } = selectVisuals([snap(1), mr(1)])
    expect(shown.map((v) => v.source)).toEqual(['mr-text', 'snapshot'])
  })

  it('shows at most 3 and moves the rest to more', () => {
    const { shown, more } = selectVisuals([snap(1), mr(1), snap(2), mr(2), snap(3)])
    expect(shown.map((v) => v.caption)).toEqual(['mr 1', 'mr 2', 'snap 1'])
    expect(more.map((v) => v.caption)).toEqual(['snap 2', 'snap 3'])
  })

  it('counts a base and head pair as one image', () => {
    expect(selectVisuals([snap(1), snap(2), snap(3)]).more).toEqual([])
  })
})
