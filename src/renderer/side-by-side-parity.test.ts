import { describe, expect, it } from 'vitest'
import { toSideBySideRows as engineToSideBySideRows } from './render.ts'
import { toSideBySideRows as uiToSideBySideRows } from '../../ui/src/diff-layout.ts'
import type { RenderedLine } from './types.ts'

/**
 * `toSideBySideRows` is hand-duplicated across the engine/UI seam (see
 * ui/src/diff-layout.ts's own comment) — each side has its own unit tests
 * that only check self-consistency, not agreement with the other copy. This
 * fails loudly the moment the two implementations diverge, since a fix made
 * on one side without the other would otherwise go unnoticed until runtime.
 */
function line(overrides: Partial<RenderedLine> & Pick<RenderedLine, 'kind'>): RenderedLine {
  return { id: 'x', text: '', overflowsInline: false, annotations: [], diagnostics: [], ...overrides }
}

const cases: Record<string, RenderedLine[]> = {
  empty: [],
  'context only': [line({ kind: 'context' })],
  'balanced remove/add pair': [line({ kind: 'remove' }), line({ kind: 'add' })],
  'more removes than adds': [line({ kind: 'remove' }), line({ kind: 'remove' }), line({ kind: 'add' })],
  'more adds than removes': [line({ kind: 'remove' }), line({ kind: 'add' }), line({ kind: 'add' })],
  'context around a change': [line({ kind: 'context' }), line({ kind: 'remove' }), line({ kind: 'add' }), line({ kind: 'context' })],
  'adds with no removes': [line({ kind: 'add' }), line({ kind: 'add' })],
  'removes with no adds': [line({ kind: 'remove' }), line({ kind: 'remove' })],
}

describe('toSideBySideRows engine/UI parity', () => {
  for (const [name, lines] of Object.entries(cases)) {
    it(`agrees on: ${name}`, () => {
      expect(uiToSideBySideRows(lines)).toEqual(engineToSideBySideRows(lines))
    })
  }
})
