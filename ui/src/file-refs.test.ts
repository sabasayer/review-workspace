import { describe, expect, it } from 'vitest'
import { diffGlimpse, isJumpClick, looksLikePath, resolveFileRef } from './file-refs.ts'
import type { RenderedFile, RenderedLine } from './types.ts'

const changed = ['src/auth/login.ts', 'utils/connector-management/repos.ts', 'a/index.ts', 'b/index.ts']

describe('looksLikePath', () => {
  it('accepts a name with a slash or an extension', () => {
    expect(looksLikePath('repos.ts')).toBe(true)
    expect(looksLikePath('utils/connector-management/repos.ts')).toBe(true)
    expect(looksLikePath('src/config')).toBe(true)
    expect(looksLikePath('./repos.ts')).toBe(true)
  })

  it('rejects plain words, calls, spaces and URLs', () => {
    expect(looksLikePath('MAX_ATTEMPTS')).toBe(false)
    expect(looksLikePath('login()')).toBe(false)
    expect(looksLikePath('two words.ts')).toBe(false)
    expect(looksLikePath('https://example.com/a.ts')).toBe(false)
    expect(looksLikePath('')).toBe(false)
    expect(looksLikePath('/etc/passwd')).toBe(false)
    expect(looksLikePath('../x.ts')).toBe(false)
  })
})

describe('resolveFileRef', () => {
  it('matches a full path', () => {
    expect(resolveFileRef('src/auth/login.ts', changed)).toEqual({ kind: 'diff', path: 'src/auth/login.ts' })
  })

  it('matches a unique path suffix', () => {
    expect(resolveFileRef('repos.ts', changed)).toEqual({ kind: 'diff', path: 'utils/connector-management/repos.ts' })
    expect(resolveFileRef('connector-management/repos.ts', changed)).toEqual({ kind: 'diff', path: 'utils/connector-management/repos.ts' })
  })

  it('does not match inside a longer name', () => {
    expect(resolveFileRef('pos.ts', changed)).toEqual({ kind: 'outside', path: 'pos.ts' })
  })

  it('reports several matches as ambiguous', () => {
    expect(resolveFileRef('index.ts', changed)).toEqual({ kind: 'ambiguous' })
  })

  it('prefers an exact path over the suffix rule', () => {
    expect(resolveFileRef('index.ts', ['index.ts', 'a/index.ts'])).toEqual({ kind: 'diff', path: 'index.ts' })
  })

  it('treats a file with no match as outside the diff', () => {
    expect(resolveFileRef('nuxt.config.ts', changed)).toEqual({ kind: 'outside', path: 'nuxt.config.ts' })
    expect(resolveFileRef('./nuxt.config.ts', changed)).toEqual({ kind: 'outside', path: 'nuxt.config.ts' })
  })
})

describe('diffGlimpse', () => {
  const line = (n: number): RenderedLine => ({ id: `f#0#${n}`, kind: 'add', text: `l${n}`, newLine: n, overflowsInline: false, annotations: [], diagnostics: [] })
  const file = (hunks: RenderedLine[][]): RenderedFile =>
    ({ path: 'f', binary: false, hunks: hunks.map((lines) => ({ lines })) }) as unknown as RenderedFile

  it('takes the first 12 lines across hunks', () => {
    const lines = diffGlimpse(file([[1, 2, 3, 4, 5, 6, 7].map(line), [8, 9, 10, 11, 12, 13, 14].map(line)]))
    expect(lines.map((l) => l.text)).toEqual(Array.from({ length: 12 }, (_, i) => `l${i + 1}`))
  })

  it('returns fewer lines for a short patch and none for a binary file', () => {
    expect(diffGlimpse(file([[1, 2].map(line)]))).toHaveLength(2)
    expect(diffGlimpse({ ...file([[line(1)]]), binary: true })).toEqual([])
  })
})

describe('isJumpClick', () => {
  it('needs Ctrl or Cmd with the main button', () => {
    expect(isJumpClick({ ctrlKey: true, metaKey: false, button: 0 })).toBe(true)
    expect(isJumpClick({ ctrlKey: false, metaKey: true, button: 0 })).toBe(true)
    expect(isJumpClick({ ctrlKey: false, metaKey: false, button: 0 })).toBe(false)
    expect(isJumpClick({ ctrlKey: true, metaKey: false, button: 2 })).toBe(false)
  })
})
