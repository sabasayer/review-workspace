import { describe, expect, it } from 'vitest'
import { countAdditions, countDeletions, shouldCollapseLargeFile, totalHunkLines } from './diff-file-stats.ts'
import { fileLevelAnnotations, lineLevelAnnotations } from './file-annotations.ts'
import { hiddenLineCount, visibleSlice } from './hunk-visibility.ts'
import type { RenderedFile } from './types.ts'

const file: RenderedFile = {
  path: 'src/a.ts',
  binary: false,
  hunks: [
    {
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 3,
      lines: [
        { id: '1', kind: 'context', text: 'a', oldLine: 1, newLine: 1, overflowsInline: false, annotations: [], diagnostics: [] },
        { id: '2', kind: 'remove', text: 'b', oldLine: 2, overflowsInline: false, annotations: [], diagnostics: [] },
        { id: '3', kind: 'add', text: 'c', newLine: 2, overflowsInline: false, annotations: [], diagnostics: [] },
      ],
    },
  ],
  annotations: [{ id: 'fa', target: { type: 'file', path: 'src/a.ts' }, summary: '' }],
  imageEvidence: [],
  pipelineEvidence: [],
  diagnostics: [],
}

describe('diff-file-stats', () => {
  it('counts additions, deletions, and total lines', () => {
    expect(countAdditions(file)).toBe(1)
    expect(countDeletions(file)).toBe(1)
    expect(totalHunkLines(file)).toBe(3)
    expect(shouldCollapseLargeFile(file)).toBe(false)
  })
})

describe('file-annotations', () => {
  it('separates file-level and line-level annotations', () => {
    const withLine = { ...file, hunks: [{ ...file.hunks[0], lines: [{ ...file.hunks[0].lines[0], annotations: [{ id: 'la', target: { type: 'line' as const, path: 'src/a.ts', side: 'head' as const, line: 1, expectedText: 'a' }, summary: '' }] }] }] }
    expect(fileLevelAnnotations(withLine)).toHaveLength(1)
    expect(lineLevelAnnotations(withLine)).toHaveLength(1)
  })
})

describe('hunk-visibility', () => {
  it('truncates long hunks until expanded', () => {
    const lines = Array.from({ length: 60 }, (_, i) => i)
    expect(visibleSlice(false, lines)).toHaveLength(50)
    expect(hiddenLineCount(false, lines)).toBe(10)
    expect(visibleSlice(true, lines)).toHaveLength(60)
  })
})
