import { describe, expect, it } from 'vitest'
import { incrementalHunks, incrementalTouchedPaths } from './incremental-patch.ts'
import type { ParsedPatch } from '../patch/types.ts'

const hunkA = {
  oldStart: 1,
  oldLines: 1,
  newStart: 1,
  newLines: 2,
  lines: [
    { kind: 'context' as const, text: 'x', oldLine: 1, newLine: 1 },
    { kind: 'add' as const, text: 'y', newLine: 2 },
  ],
}

const hunkAChanged = {
  ...hunkA,
  newLines: 3,
  lines: [...hunkA.lines, { kind: 'add' as const, text: 'z', newLine: 3 }],
}

describe('incrementalHunks', () => {
  it('reports no incremental hunks when a file is byte-identical between rounds', () => {
    const previous: ParsedPatch = { files: [{ path: 'a.ts', binary: false, hunks: [hunkA] }] }
    const current: ParsedPatch = { files: [{ path: 'a.ts', binary: false, hunks: [hunkA] }] }
    expect(incrementalHunks(previous, current, 'a.ts')).toEqual([])
  })

  it('reports a hunk as incremental when its content differs from the previous round', () => {
    const previous: ParsedPatch = { files: [{ path: 'a.ts', binary: false, hunks: [hunkA] }] }
    const current: ParsedPatch = { files: [{ path: 'a.ts', binary: false, hunks: [hunkAChanged] }] }
    expect(incrementalHunks(previous, current, 'a.ts')).toEqual([hunkAChanged])
  })

  it('treats every hunk of a file absent from the previous patch as incremental', () => {
    const previous: ParsedPatch = { files: [] }
    const current: ParsedPatch = { files: [{ path: 'a.ts', binary: false, hunks: [hunkA] }] }
    expect(incrementalHunks(previous, current, 'a.ts')).toEqual([hunkA])
  })

  it('returns an empty array for a file absent from the current patch', () => {
    const previous: ParsedPatch = { files: [{ path: 'a.ts', binary: false, hunks: [hunkA] }] }
    const current: ParsedPatch = { files: [] }
    expect(incrementalHunks(previous, current, 'a.ts')).toEqual([])
  })
})

describe('incrementalTouchedPaths', () => {
  it('only includes files with at least one incremental hunk', () => {
    const previous: ParsedPatch = {
      files: [
        { path: 'touched.ts', binary: false, hunks: [hunkA] },
        { path: 'untouched.ts', binary: false, hunks: [hunkA] },
      ],
    }
    const current: ParsedPatch = {
      files: [
        { path: 'touched.ts', binary: false, hunks: [hunkAChanged] },
        { path: 'untouched.ts', binary: false, hunks: [hunkA] },
      ],
    }
    expect(incrementalTouchedPaths(previous, current)).toEqual(new Set(['touched.ts']))
  })
})
