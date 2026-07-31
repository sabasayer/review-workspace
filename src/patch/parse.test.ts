import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePatch } from './parse.ts'
import { PatchParseError } from './types.ts'

function loadPatch(name: string) {
  return readFileSync(new URL(`../../fixtures/patches/${name}`, import.meta.url), 'utf-8')
}

describe('parsePatch', () => {
  it('parses a single-file text change', () => {
    const result = parsePatch(loadPatch('single-file.diff'))
    expect(result.files).toHaveLength(1)
    const [file] = result.files
    expect(file.path).toBe('src/auth/login.ts')
    expect(file.binary).toBe(false)
    expect(file.hunks).toHaveLength(1)
    const [hunk] = file.hunks
    expect(hunk.lines.filter((l) => l.kind === 'add')).toHaveLength(4)
    expect(hunk.lines.filter((l) => l.kind === 'context')).toHaveLength(4)
  })

  it('parses a multi-file change preserving file order', () => {
    const result = parsePatch(loadPatch('multi-file.diff'))
    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts', 'src/b.ts'])
    expect(result.files[0].hunks[0].lines.map((l) => l.kind)).toEqual(['remove', 'add', 'context'])
    expect(result.files[1].hunks[0].lines.map((l) => l.kind)).toEqual(['remove', 'add'])
  })

  it('parses a bare POSIX unified diff with no "diff --git" header and no a/ b/ path prefixes', () => {
    const result = parsePatch(loadPatch('headerless.diff'))
    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts', 'src/b.ts'])
    expect(result.files[0].hunks[0].lines.map((l) => l.kind)).toEqual(['remove', 'add', 'context'])
  })

  it('parses a bare unified diff binary change (--- / +++ / Binary files, no "diff --git") as one file, not two', () => {
    const result = parsePatch(loadPatch('headerless-binary.diff'))
    expect(result.files).toHaveLength(1)
    expect(result.files[0]).toMatchObject({ path: 'assets/logo.png', binary: true, hunks: [] })
  })

  it('parses a bare unified diff binary deletion (Binary marker reads "and /dev/null differ") using the real path, not /dev/null', () => {
    const result = parsePatch(loadPatch('headerless-binary-deleted.diff'))
    expect(result.files.map((f) => f.path)).toEqual(['assets/old-logo.png', 'src/a.ts'])
    expect(result.files[0]).toMatchObject({ path: 'assets/old-logo.png', binary: true, hunks: [] })
  })

  it('marks a binary change distinctly, with no hunks', () => {
    const result = parsePatch(loadPatch('binary-change.diff'))
    expect(result.files).toHaveLength(1)
    expect(result.files[0].binary).toBe(true)
    expect(result.files[0].hunks).toHaveLength(0)
  })

  it('throws PatchParseError on a truncated hunk', () => {
    expect(() => parsePatch(loadPatch('corrupt.diff'))).toThrow(PatchParseError)
  })

  it('handles a "no newline at end of file" marker immediately following a self-closed hunk, followed by another file', () => {
    const result = parsePatch(loadPatch('no-newline-at-eof.diff'))
    expect(result.files.map((f) => f.path)).toEqual(['a.json', 'b.ts'])
    expect(result.files[0].hunks[0].lines.map((l) => l.text)).toEqual(['{', '}'])
    expect(result.files[1].hunks[0].lines.map((l) => l.text)).toEqual(['export const b = 1'])
  })

  it('preserves one logical line per structural row (no merging)', () => {
    const result = parsePatch(loadPatch('single-file.diff'))
    const lines = result.files[0].hunks[0].lines
    expect(lines.every((l) => !l.text.includes('\n'))).toBe(true)
  })
})
