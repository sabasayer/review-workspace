import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveRepoPath } from './repo-path-cache.ts'

let workDir: string
let cachePath: string
let realRepoDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'review-workspace-repo-path-cache-'))
  cachePath = join(workDir, 'nested', 'review-workspace-repo-paths.json')
  realRepoDir = join(workDir, 'my-repo')
  mkdirSync(realRepoDir)
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('resolveRepoPath', () => {
  it('asks and caches the answer when the repo has never been asked about', async () => {
    let askedFor: string | undefined
    const ask = async (repoSlug: string) => {
      askedFor = repoSlug
      return realRepoDir
    }

    const result = await resolveRepoPath('example/widgets', ask, cachePath)

    expect(result).toBe(realRepoDir)
    expect(askedFor).toBe('example/widgets')
    const cache = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(cache).toEqual({ 'example/widgets': realRepoDir })
  })

  it('reuses a cached path without asking again', async () => {
    mkdirSync(join(workDir, 'nested'), { recursive: true })
    writeFileSync(cachePath, JSON.stringify({ 'example/widgets': realRepoDir }))

    let askCalled = false
    const ask = async () => {
      askCalled = true
      return 'should-not-be-used'
    }

    const result = await resolveRepoPath('example/widgets', ask, cachePath)

    expect(result).toBe(realRepoDir)
    expect(askCalled).toBe(false)
  })

  it('asks again and updates the cache when the cached path no longer exists on disk', async () => {
    mkdirSync(join(workDir, 'nested'), { recursive: true })
    const staleRepoDir = join(workDir, 'moved-away')
    writeFileSync(cachePath, JSON.stringify({ 'example/widgets': staleRepoDir }))

    const ask = async () => realRepoDir
    const result = await resolveRepoPath('example/widgets', ask, cachePath)

    expect(result).toBe(realRepoDir)
    const cache = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(cache).toEqual({ 'example/widgets': realRepoDir })
  })

  it('preserves other repos already in the cache when adding a new one', async () => {
    mkdirSync(join(workDir, 'nested'), { recursive: true })
    const otherRepoDir = join(workDir, 'other-repo')
    mkdirSync(otherRepoDir)
    writeFileSync(cachePath, JSON.stringify({ 'example/other': otherRepoDir }))

    const ask = async () => realRepoDir
    await resolveRepoPath('example/widgets', ask, cachePath)

    const cache = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(cache).toEqual({ 'example/other': otherRepoDir, 'example/widgets': realRepoDir })
  })
})
