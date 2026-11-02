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

  it('marks a git binary file with "new file mode" as added', () => {
    const patch = 'diff --git a/shots/new.png b/shots/new.png\nnew file mode 100644\nindex 0000000..2222222\nBinary files /dev/null and b/shots/new.png differ\n'
    expect(parsePatch(patch).files[0]).toMatchObject({ path: 'shots/new.png', binary: true, added: true })
  })

  it('marks a bare binary file that starts from /dev/null as added', () => {
    const patch = '--- /dev/null\n+++ b/shots/new.png\nBinary files /dev/null and b/shots/new.png differ\n'
    expect(parsePatch(patch).files[0]).toMatchObject({ path: 'shots/new.png', binary: true, added: true })
  })

  it('does not mark a changed binary file as added', () => {
    expect(parsePatch(loadPatch('binary-change.diff')).files[0].added).toBeFalsy()
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
  it('skips extended git header lines for new, deleted, and renamed files', () => {
    const diff = [
      'diff --git a/src/new.ts b/src/new.ts',
      'new file mode 100644',
      'index 0000000..1111111',
      '--- /dev/null',
      '+++ b/src/new.ts',
      '@@ -0,0 +1,2 @@',
      '+export const a = 1',
      '+export const b = 2',
      'diff --git a/src/gone.ts b/src/gone.ts',
      'deleted file mode 100644',
      'index 2222222..0000000',
      '--- a/src/gone.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-export const gone = true',
      'diff --git a/src/old-name.ts b/src/new-name.ts',
      'similarity index 90%',
      'rename from src/old-name.ts',
      'rename to src/new-name.ts',
      'index 3333333..4444444 100644',
      '--- a/src/old-name.ts',
      '+++ b/src/new-name.ts',
      '@@ -1 +1 @@',
      '-const x = 1',
      '+const x = 2',
      'diff --git a/run.sh b/run.sh',
      'old mode 100644',
      'new mode 100755',
      'diff --git a/last.ts b/last.ts',
      'index 5555555..6666666 100644',
      '--- a/last.ts',
      '+++ b/last.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      '',
    ].join('\n')

    const result = parsePatch(diff)

    expect(result.files.map((f) => [f.oldPath, f.path])).toEqual([
      ['src/new.ts', 'src/new.ts'],
      ['src/gone.ts', 'src/gone.ts'],
      ['src/old-name.ts', 'src/new-name.ts'],
      ['last.ts', 'last.ts'],
    ])
    expect(result.files[0].hunks[0].lines).toHaveLength(2)
  })
})
