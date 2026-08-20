import { describe, expect, it } from 'vitest'
import { buildAnnotationNumbers } from './annotation-numbers.ts'
import { groupFilesByBehavioralGroup } from './grouped-files.ts'
import type { RenderedFile, RenderedGroup } from './types.ts'

function file(path: string): RenderedFile {
  return {
    path,
    binary: false,
    verification: [],
    hunks: [],
    annotations: [{ id: 'a-file', target: { type: 'file', path }, summary: 'file note', evidence: [], verification: [] }],
    imageEvidence: [],
    pipelineEvidence: [],
    diagnostics: [],
  }
}

describe('groupFilesByBehavioralGroup', () => {
  const groups: RenderedGroup[] = [
    { id: 'g1', title: 'Auth', order: 0, filePaths: ['src/auth/login.ts'] },
  ]

  it('groups assigned files and buckets the rest', () => {
    const buckets = groupFilesByBehavioralGroup([file('src/auth/login.ts'), file('src/other.ts')], groups)
    expect(buckets).toHaveLength(2)
    expect(buckets[0].files.map((f) => f.path)).toEqual(['src/auth/login.ts'])
    expect(buckets[1].group).toBeNull()
    expect(buckets[1].files.map((f) => f.path)).toEqual(['src/other.ts'])
  })
})

describe('buildAnnotationNumbers', () => {
  it('numbers file-level then line-level annotations in reading order', () => {
    const login = file('src/auth/login.ts')
    login.hunks = [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          {
            id: 'l1',
            kind: 'add',
            text: 'x',
            newLine: 1,
            overflowsInline: false,
            annotations: [{ id: 'a-line', target: { type: 'line', path: 'src/auth/login.ts', side: 'head', line: 1, expectedText: 'x' }, summary: '', evidence: [], verification: [] }],
            diagnostics: [],
          },
        ],
      },
    ]
    const numbers = buildAnnotationNumbers(groupFilesByBehavioralGroup([login], []))
    expect(numbers.get('a-file')).toBe(1)
    expect(numbers.get('a-line')).toBe(2)
  })
})
