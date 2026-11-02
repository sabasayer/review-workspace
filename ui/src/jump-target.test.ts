import { describe, expect, it } from 'vitest'
import { canJumpToTarget, jumpTargetLineId } from './jump-target.ts'
import type { RenderedFile } from './types.ts'

const files = [
  {
    path: 'a.ts',
    hunks: [
      { lines: [{ id: 'a.ts#0#0', oldLine: 1, newLine: 1 }, { id: 'a.ts#0#1', newLine: 2 }] },
      { lines: [{ id: 'a.ts#1#0', oldLine: 9, newLine: 10 }] },
    ],
  },
] as unknown as RenderedFile[]

describe('canJumpToTarget', () => {
  it('is true for a line or hunk Target only', () => {
    expect(canJumpToTarget({ type: 'line', path: 'a.ts', side: 'head', line: 2, expectedText: '' })).toBe(true)
    expect(canJumpToTarget({ type: 'hunk', path: 'a.ts', hunkIndex: 0 })).toBe(true)
    expect(canJumpToTarget({ type: 'file', path: 'a.ts' })).toBe(false)
    expect(canJumpToTarget({ type: 'binary', path: 'a.png' })).toBe(false)
  })
})

describe('jumpTargetLineId', () => {
  it('finds the line of a line Target', () => {
    expect(jumpTargetLineId(files, { type: 'line', path: 'a.ts', side: 'head', line: 2, expectedText: '' })).toBe('a.ts#0#1')
    expect(jumpTargetLineId(files, { type: 'line', path: 'a.ts', side: 'base', line: 9, expectedText: '' })).toBe('a.ts#1#0')
  })

  it('uses the first line of a hunk Target', () => {
    expect(jumpTargetLineId(files, { type: 'hunk', path: 'a.ts', hunkIndex: 1 })).toBe('a.ts#1#0')
  })

  it('returns undefined when nothing matches', () => {
    expect(jumpTargetLineId(files, { type: 'hunk', path: 'a.ts', hunkIndex: 5 })).toBeUndefined()
    expect(jumpTargetLineId(files, { type: 'line', path: 'a.ts', side: 'head', line: 99, expectedText: '' })).toBeUndefined()
    expect(jumpTargetLineId(files, { type: 'file', path: 'a.ts' })).toBeUndefined()
    expect(jumpTargetLineId(files, { type: 'hunk', path: 'zzz', hunkIndex: 0 })).toBeUndefined()
  })
})
