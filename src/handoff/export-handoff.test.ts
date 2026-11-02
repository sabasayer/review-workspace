import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'review-workspace-export-handoff-'))
  repoDir = join(workDir, 'target-repo')
  mkdirSync(repoDir)
  execFileSync('git', ['init', '-q'], { cwd: repoDir })
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

function baseOptions(overrides: Partial<Parameters<typeof exportHandoff>[0]> = {}) {
  return {
    bundlePath: '/bundles/example',
    comparison,
    round: 1,
    comments: [openChangeRequest],
    annotations: [],
    ...overrides,
  }
}

describe('exportHandoff', () => {
  it('is a no-op when there are no open change-request comments', async () => {
    const result = await exportHandoff(baseOptions({ comments: [{ ...openChangeRequest, status: 'resolved' as const, resolved: true }], repoPath: repoDir }))

    expect(result).toEqual({ written: false })
    expect(existsSync(join(repoDir, '.review-feedback'))).toBe(false)
  })

  it('writes the hand-off file into the repo and excludes it through .git/info/exclude', async () => {
    const result = await exportHandoff(baseOptions({ round: 3, repoPath: repoDir }))

    expect(result.written).toBe(true)
    expect(result.repoPath).toBe(repoDir)
    expect(result.filePath).toBe(join(repoDir, '.review-feedback', '42-round3.md'))

    const written = readFileSync(result.filePath!, 'utf-8')
    expect(written).toContain('Please handle the error path.')
    expect(written).toContain('round: 3')

    expect(readFileSync(join(repoDir, '.git', 'info', 'exclude'), 'utf-8')).toContain('.review-feedback/')
    expect(existsSync(join(repoDir, '.gitignore'))).toBe(false)
  })

  it('skips the export with a reason when no repo path is given', async () => {
    const result = await exportHandoff(baseOptions())

    expect(result).toEqual({ written: false, skipped: 'no-repo-path' })
  })

  it('skips the export without writing a file when the path is not a git repo', async () => {
    const plainDir = join(workDir, 'plain')
    mkdirSync(plainDir)

    const result = await exportHandoff(baseOptions({ repoPath: plainDir }))

    expect(result).toEqual({ written: false, skipped: 'not-a-git-repo' })
    expect(existsSync(join(plainDir, '.review-feedback'))).toBe(false)
  })
})
