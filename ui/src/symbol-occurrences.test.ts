import { describe, expect, it } from 'vitest'
import { findSymbolOccurrences, wordAtOffset } from './symbol-occurrences.ts'
import type { RenderedFile } from './types.ts'

describe('wordAtOffset', () => {
  it('returns the identifier containing the offset', () => {
    expect(wordAtOffset('foo(bar)', 5)).toBe('bar')
  })

  it('returns null when the offset sits between two non-word characters', () => {
    expect(wordAtOffset('foo  bar', 4)).toBeNull()
  })

  it('returns null when the word starts with a digit', () => {
    expect(wordAtOffset('const x = 42', 11)).toBeNull()
  })

  it('matches at the start and end boundaries of the word', () => {
    expect(wordAtOffset('foo(bar)', 4)).toBe('bar')
    expect(wordAtOffset('foo(bar)', 7)).toBe('bar')
  })
})

function file(path: string, lines: Array<{ text: string; newLine?: number; oldLine?: number }>): RenderedFile {
  return {
    path,
    binary: false,
    hunks: [
      {
        oldStart: 1,
        oldLines: lines.length,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((l, i) => ({
          id: `${path}#0#${i}`,
          kind: 'context',
          text: l.text,
          oldLine: l.oldLine,
          newLine: l.newLine,
          overflowsInline: false,
          annotations: [],
          diagnostics: [],
        })),
      },
    ],
    annotations: [],
    imageEvidence: [],
    pipelineEvidence: [],
    verification: [],
    diagnostics: [],
  }
}

describe('findSymbolOccurrences', () => {
  it('finds whole-word matches across files, ignoring substrings', () => {
    const files = [
      file('a.ts', [{ text: 'function foo() {}', newLine: 1 }]),
      file('b.ts', [
        { text: 'const foobar = foo()', newLine: 1 },
        { text: 'return foo', newLine: 2 },
      ]),
    ]
    const occurrences = findSymbolOccurrences(files, 'foo')
    expect(occurrences).toHaveLength(3)
    expect(occurrences.map((o) => o.path)).toEqual(['a.ts', 'b.ts', 'b.ts'])
  })

  it('returns nothing when the symbol never occurs', () => {
    const files = [file('a.ts', [{ text: 'const x = 1', newLine: 1 }])]
    expect(findSymbolOccurrences(files, 'missing')).toHaveLength(0)
  })
})
