import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Comment } from '../questions/types.ts'
import type { Comparison } from '../schema/types.ts'
import { exportHandoff } from './export-handoff.ts'

const comparison: Comparison = { base: 'aaa1111', head: 'bbb2222', repository: 'example/widgets', number: '42' }

const openChangeRequest: Comment = {
  id: 'cr-1',
  createdAt: '2026-08-01T10:00:00.000Z',
  body: 'Please handle the error path.',
  target: { type: 'file', path: 'src/config.ts' },
  kind: 'change-request',
  status: 'open',
  resolved: false,
}

let workDir: string
let repoDir: string
let cachePath: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'review-workspace-export-handoff-'))
  repoDir = join(workDir, 'target-repo')
  mkdirSync(repoDir)
  cachePath = join(workDir, 'repo-paths.json')
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('exportHandoff', () => {
  it('is a no-op when there are no open change-request comments', async () => {
    let askCalled = false
    const result = await exportHandoff({
      bundlePath: '/bundles/example',
      comparison,
      round: 1,
      comments: [{ ...openChangeRequest, resolved: true }],
      annotations: [],
      ask: async () => {
        askCalled = true
        return repoDir
      },
      repoPathCachePath: cachePath,
    })

    expect(result).toEqual({ written: false })
    expect(askCalled).toBe(false)
    expect(existsSync(join(repoDir, '.review-feedback'))).toBe(false)
  })

  it('writes the hand-off file into the target repo and ensures .gitignore, asking for the path the first time', async () => {
    let askedFor: string | undefined
    const result = await exportHandoff({
      bundlePath: '/bundles/example',
      comparison,
      round: 3,
      comments: [openChangeRequest],
      annotations: [],
      ask: async (repoSlug) => {
        askedFor = repoSlug
        return repoDir
      },
      repoPathCachePath: cachePath,
    })

    expect(askedFor).toBe('example/widgets')
    expect(result.written).toBe(true)
    expect(result.repoPath).toBe(repoDir)
    expect(result.filePath).toBe(join(repoDir, '.review-feedback', '42-round3.md'))

    const written = readFileSync(result.filePath!, 'utf-8')
    expect(written).toContain('Please handle the error path.')
    expect(written).toContain('round: 3')

    expect(readFileSync(join(repoDir, '.gitignore'), 'utf-8')).toBe('.review-feedback/\n')
  })

  it('reuses the cached repo path on a second export without asking again', async () => {
    await exportHandoff({
      bundlePath: '/bundles/example',
      comparison,
      round: 1,
      comments: [openChangeRequest],
      annotations: [],
      ask: async () => repoDir,
      repoPathCachePath: cachePath,
    })

    let askCalledAgain = false
    await exportHandoff({
      bundlePath: '/bundles/example',
      comparison,
      round: 2,
      comments: [openChangeRequest],
      annotations: [],
      ask: async () => {
        askCalledAgain = true
        return repoDir
      },
      repoPathCachePath: cachePath,
    })

    expect(askCalledAgain).toBe(false)
    expect(existsSync(join(repoDir, '.review-feedback', '42-round1.md'))).toBe(true)
    expect(existsSync(join(repoDir, '.review-feedback', '42-round2.md'))).toBe(true)
  })

  it('throws when the comparison has no repository to key the cache by', async () => {
    await expect(
      exportHandoff({
        bundlePath: '/bundles/example',
        comparison: { base: 'a', head: 'b' },
        round: 1,
        comments: [openChangeRequest],
        annotations: [],
        ask: async () => repoDir,
        repoPathCachePath: cachePath,
      }),
    ).rejects.toThrow(/repository/)
  })

  it('does not duplicate an existing broader .gitignore entry', async () => {
    writeFileSync(join(repoDir, '.gitignore'), '.review-feedback/**\n')

    await exportHandoff({
      bundlePath: '/bundles/example',
      comparison,
      round: 1,
      comments: [openChangeRequest],
      annotations: [],
      ask: async () => repoDir,
      repoPathCachePath: cachePath,
    })

    expect(readFileSync(join(repoDir, '.gitignore'), 'utf-8')).toBe('.review-feedback/**\n')
  })
})
