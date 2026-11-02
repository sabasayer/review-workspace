import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_REPO_FILE_BYTES, readRepoFileTop } from './repo-file.ts'

let repo: string
let outside: string

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'rw-repo-'))
  outside = mkdtempSync(join(tmpdir(), 'rw-outside-'))
  mkdirSync(join(repo, 'utils'))
  writeFileSync(join(repo, 'utils', 'repos.ts'), Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n'))
  writeFileSync(join(outside, 'secret.txt'), 'secret')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

describe('readRepoFileTop', () => {
  it('returns the first lines of a text file', () => {
    const result = readRepoFileTop(repo, 'utils/repos.ts', 40)
    expect(result).toMatchObject({ ok: true, path: 'utils/repos.ts', truncated: true })
    expect(result.ok && result.content.split('\n')).toHaveLength(40)
    expect(result.ok && result.content.startsWith('line 1\n')).toBe(true)
  })

  it('marks a short file as not truncated', () => {
    writeFileSync(join(repo, 'short.txt'), 'a\nb\n')
    expect(readRepoFileTop(repo, 'short.txt', 40)).toMatchObject({ ok: true, truncated: false, content: 'a\nb' })
  })

  it('refuses when no repo is configured', () => {
    expect(readRepoFileTop(undefined, 'utils/repos.ts', 40)).toEqual({ ok: false, reason: 'no-repo' })
  })

  it('refuses an absolute path', () => {
    expect(readRepoFileTop(repo, join(outside, 'secret.txt'), 40)).toEqual({ ok: false, reason: 'unsafe-path' })
  })

  it('refuses a path with ..', () => {
    expect(readRepoFileTop(repo, '../secret.txt', 40)).toEqual({ ok: false, reason: 'unsafe-path' })
    expect(readRepoFileTop(repo, 'utils/../utils/repos.ts', 40)).toEqual({ ok: false, reason: 'unsafe-path' })
  })

  it('refuses an empty path and a path with a null byte', () => {
    expect(readRepoFileTop(repo, '', 40)).toEqual({ ok: false, reason: 'unsafe-path' })
    expect(readRepoFileTop(repo, 'a\0b', 40)).toEqual({ ok: false, reason: 'unsafe-path' })
  })

  it('refuses a symlink that leaves the repo', () => {
    symlinkSync(join(outside, 'secret.txt'), join(repo, 'link.txt'))
    expect(readRepoFileTop(repo, 'link.txt', 40)).toEqual({ ok: false, reason: 'unsafe-path' })
  })

  it('refuses a symlinked directory that leaves the repo', () => {
    symlinkSync(outside, join(repo, 'outdir'))
    expect(readRepoFileTop(repo, 'outdir/secret.txt', 40)).toEqual({ ok: false, reason: 'unsafe-path' })
  })

  it('allows a symlink that stays inside the repo', () => {
    symlinkSync(join(repo, 'utils', 'repos.ts'), join(repo, 'alias.ts'))
    expect(readRepoFileTop(repo, 'alias.ts', 5)).toMatchObject({ ok: true })
  })

  it('reports a missing file', () => {
    expect(readRepoFileTop(repo, 'nope.ts', 40)).toEqual({ ok: false, reason: 'not-found' })
  })

  it('refuses a directory', () => {
    expect(readRepoFileTop(repo, 'utils', 40)).toEqual({ ok: false, reason: 'not-a-file' })
  })

  it('refuses a file over the size limit', () => {
    writeFileSync(join(repo, 'big.txt'), 'x'.repeat(MAX_REPO_FILE_BYTES + 1))
    expect(readRepoFileTop(repo, 'big.txt', 40)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('refuses a binary file', () => {
    writeFileSync(join(repo, 'img.bin'), Buffer.from([0x89, 0x50, 0x00, 0x47]))
    expect(readRepoFileTop(repo, 'img.bin', 40)).toEqual({ ok: false, reason: 'not-text' })
  })

  it('falls back to 40 lines for a bad line count', () => {
    const result = readRepoFileTop(repo, 'utils/repos.ts', Number.NaN)
    expect(result.ok && result.content.split('\n')).toHaveLength(40)
  })

  it('caps the line count at 200', () => {
    const result = readRepoFileTop(repo, 'utils/repos.ts', 100000)
    expect(result.ok && result.content.split('\n')).toHaveLength(100)
  })
})
