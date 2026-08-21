import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateBundle } from './validate-bundle.ts'
import { checkRound, mrKeyFor, nextRoundBundlePath, scaffoldNextRound } from './round.ts'

const round1Fixture = fileURLToPath(new URL('../../fixtures/bundles/chained-mr-42/', import.meta.url))
const round2Fixture = fileURLToPath(new URL('../../fixtures/bundles/chained-mr-42-r2/', import.meta.url))
const incrementalPatch = readFileSync(join(round2Fixture, 'changes.diff'), 'utf-8')

let workParent: string
let workBundle: string

beforeEach(() => {
  workParent = mkdtempSync(join(tmpdir(), 'review-workspace-round-'))
  workBundle = join(workParent, 'chained-mr-42')
  mkdirSync(workBundle)
  cpSync(round1Fixture, workBundle, { recursive: true })
})

afterEach(() => {
  rmSync(workParent, { recursive: true, force: true })
})

describe('mrKeyFor', () => {
  it('combines repository and number into a stable cross-round identity', () => {
    expect(mrKeyFor({ base: 'a', head: 'b', repository: 'example/widgets', number: '42' })).toBe('example/widgets!42')
  })

  it('throws when repository or number is missing', () => {
    expect(() => mrKeyFor({ base: 'a', head: 'b' })).toThrow(/repository and comparison.number/)
    expect(() => mrKeyFor({ base: 'a', head: 'b', repository: 'example/widgets' })).toThrow()
    expect(() => mrKeyFor({ base: 'a', head: 'b', number: '42' })).toThrow()
  })
})

describe('checkRound', () => {
  it('reports no new round needed when the live head matches the recorded head', () => {
    const result = checkRound(workBundle, 'bbb2222')
    expect(result.needsNewRound).toBe(false)
    expect(result.recordedHead).toBe('bbb2222')
  })

  it('reports a new round is needed when the live head has moved', () => {
    const result = checkRound(workBundle, 'ccc3333')
    expect(result.needsNewRound).toBe(true)
    expect(result.recordedHead).toBe('bbb2222')
    expect(result.liveHead).toBe('ccc3333')
  })
})

describe('nextRoundBundlePath', () => {
  it('appends -r2 to a round-1 bundle path', () => {
    expect(nextRoundBundlePath(workBundle)).toBe(join(workParent, 'chained-mr-42-r2'))
  })

  it('increments an existing -r{N} suffix', () => {
    const round2Path = join(workParent, 'chained-mr-42-r2')
    expect(nextRoundBundlePath(round2Path)).toBe(join(workParent, 'chained-mr-42-r3'))
  })

  it('resolves a relative "." bundle path to a real sibling, not a "-r2" literal', () => {
    const cwd = process.cwd()
    process.chdir(workBundle)
    try {
      // basename only: process.cwd() after chdir may report a resolved
      // symlink form of workParent (e.g. macOS's /private/var vs /var), so
      // the parent directory string itself isn't guaranteed to match — what
      // matters is that the sibling name is right, not nested inside "."
      // as a literal ".-r2".
      expect(basename(nextRoundBundlePath('.'))).toBe('chained-mr-42-r2')
    } finally {
      process.chdir(cwd)
    }
  })
})

describe('scaffoldNextRound', () => {
  it('creates a sibling bundle rather than mutating the original', () => {
    const originalReviewJson = readFileSync(join(workBundle, 'review.json'), 'utf-8')

    const result = scaffoldNextRound(workBundle, 'ccc3333', { patch: incrementalPatch })

    expect(result.bundlePath).toBe(join(workParent, 'chained-mr-42-r2'))
    expect(existsSync(result.bundlePath)).toBe(true)
    expect(readFileSync(join(workBundle, 'review.json'), 'utf-8')).toBe(originalReviewJson)
  })

  it('writes a chain.json with mrKey, round, previousBundle, and previousHead', () => {
    const result = scaffoldNextRound(workBundle, 'ccc3333', { patch: incrementalPatch })

    expect(result.chain).toEqual({
      mrKey: 'example/widgets!42',
      round: 2,
      previousBundle: `../${basename(workBundle)}`,
      previousHead: 'bbb2222',
    })
    const written = JSON.parse(readFileSync(join(result.bundlePath, 'chain.json'), 'utf-8'))
    expect(written).toEqual(result.chain)
  })

  it('carries the Comparison forward with the new head and preserves the base', () => {
    const result = scaffoldNextRound(workBundle, 'ccc3333', { patch: incrementalPatch })

    const document = JSON.parse(readFileSync(join(result.bundlePath, 'review.json'), 'utf-8'))
    expect(document.comparison.head).toBe('ccc3333')
    expect(document.comparison.base).toBe('aaa1111')
    expect(document.comparison.repository).toBe('example/widgets')
    expect(document.comparison.number).toBe(42)
  })

  it('produces a fully valid, independently-openable bundle', () => {
    const result = scaffoldNextRound(workBundle, 'ccc3333', { patch: incrementalPatch })

    const validation = validateBundle(result.bundlePath)
    expect(validation.valid).toBe(true)
  })

  it('increments the round and derives the base name when chaining off an existing round', () => {
    const round2Work = join(workParent, 'chained-mr-42-r2')
    mkdirSync(round2Work)
    cpSync(round2Fixture, round2Work, { recursive: true })

    const result = scaffoldNextRound(round2Work, 'ddd4444', { patch: incrementalPatch })

    expect(result.bundlePath).toBe(join(workParent, 'chained-mr-42-r3'))
    expect(result.chain).toEqual({
      mrKey: 'example/widgets!42',
      round: 3,
      previousBundle: '../chained-mr-42-r2',
      previousHead: 'ccc3333',
    })
  })

  it('refuses to scaffold when the live head already matches the recorded head', () => {
    expect(() => scaffoldNextRound(workBundle, 'bbb2222', { patch: incrementalPatch })).toThrow(/no new round is needed/)
  })

  it('refuses to overwrite an already-scaffolded round', () => {
    scaffoldNextRound(workBundle, 'ccc3333', { patch: incrementalPatch })

    expect(() => scaffoldNextRound(workBundle, 'ccc3333', { patch: incrementalPatch })).toThrow(/already exists/)
  })

  it('scaffolds a real sibling when invoked with a relative "." bundle path', () => {
    const cwd = process.cwd()
    process.chdir(workBundle)
    try {
      const result = scaffoldNextRound('.', 'ccc3333', { patch: incrementalPatch })

      expect(basename(result.bundlePath)).toBe('chained-mr-42-r2')
      expect(existsSync(join(workBundle, '.-r2'))).toBe(false)
      expect(result.chain.previousBundle).toBe(`../${basename(workBundle)}`)
    } finally {
      process.chdir(cwd)
    }
  })
})
