import { describe, expect, it } from 'vitest'
import { lineIdsForTarget } from './line-highlight.ts'
import type { RenderedFile, RenderedLine } from './types.ts'

function line(id: string, oldLine: number | undefined, newLine: number | undefined): RenderedLine {
  return { id, kind: 'context', text: '', oldLine, newLine, overflowsInline: false, annotations: [], diagnostics: [] }
}

const file = {
  path: 'a.ts',
  hunks: [{ lines: [line('a.ts#0#0', 1, 1), line('a.ts#0#1', undefined, 2), line('a.ts#0#2', 2, undefined)] }],
} as unknown as RenderedFile

describe('lineIdsForTarget', () => {
  it('finds the head line', () => {
    expect(lineIdsForTarget([file], { type: 'line', path: 'a.ts', side: 'head', line: 2, expectedText: '' })).toEqual(['a.ts#0#1'])
  })

  it('finds the base line', () => {
    expect(lineIdsForTarget([file], { type: 'line', path: 'a.ts', side: 'base', line: 2, expectedText: '' })).toEqual(['a.ts#0#2'])
  })

  it('returns nothing for a file target or an unknown file', () => {
    expect(lineIdsForTarget([file], { type: 'file', path: 'a.ts' })).toEqual([])
    expect(lineIdsForTarget([file], { type: 'line', path: 'b.ts', side: 'head', line: 1, expectedText: '' })).toEqual([])
  })
})
