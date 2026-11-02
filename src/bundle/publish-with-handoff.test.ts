import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { raiseQuestion } from '../questions/questions-log.ts'
import { publishBundleAndExportHandoff } from './publish-with-handoff.ts'

const fixtureBundle = fileURLToPath(new URL('../../fixtures/bundles/valid/', import.meta.url))

let workBundle: string
let repoDir: string

beforeEach(() => {
  const parent = mkdtempSync(join(tmpdir(), 'review-workspace-publish-handoff-'))
  workBundle = join(parent, 'bundle')
  mkdirSync(workBundle)
  cpSync(fixtureBundle, workBundle, { recursive: true })
  repoDir = join(parent, 'target-repo')
  mkdirSync(repoDir)
  execFileSync('git', ['init', '-q'], { cwd: repoDir })
})

afterEach(() => {
  rmSync(join(workBundle, '..'), { recursive: true, force: true })
})

function stageValidUpdate(comparison: Record<string, unknown> = { base: 'abc1111', head: 'def2222', repository: 'example/widgets', number: '7' }) {
  writeFileSync(join(workBundle, 'review.next.json'), JSON.stringify({ schemaVersion: 1, comparison }))
}

describe('publishBundleAndExportHandoff', () => {
  it('publishes without exporting a hand-off file when there are no open change-requests', async () => {
    stageValidUpdate()
    const result = await publishBundleAndExportHandoff(workBundle, { repoPath: repoDir })

    expect(result.ok).toBe(true)
    expect(result.handoff).toEqual({ written: false })
    expect(existsSync(join(repoDir, '.review-feedback'))).toBe(false)
  })

  it('does not attempt a hand-off export when the publish itself is rejected', async () => {
    const result = await publishBundleAndExportHandoff(workBundle, { repoPath: repoDir })

    expect(result.ok).toBe(false)
    expect(result.handoff).toBeUndefined()
    expect(existsSync(join(repoDir, '.review-feedback'))).toBe(false)
  })

  it('exports round 1 (no chain.json) when publishing a bundle with an open change-request', async () => {
    stageValidUpdate()
    raiseQuestion(workBundle, 'Please fix the retry logic.', { type: 'file', path: 'src/config.ts' }, 'change-request')

    const result = await publishBundleAndExportHandoff(workBundle, { repoPath: repoDir })

    expect(result.ok).toBe(true)
    expect(result.handoff?.written).toBe(true)
    const filePath = join(repoDir, '.review-feedback', '7-round1.md')
    expect(result.handoff?.filePath).toBe(filePath)
    expect(readFileSync(filePath, 'utf-8')).toContain('Please fix the retry logic.')
    expect(existsSync(join(repoDir, '.gitignore'))).toBe(false)
  })

  it('skips the export without prompting when no repo path is given', async () => {
    stageValidUpdate()
    raiseQuestion(workBundle, 'Please fix the retry logic.', { type: 'file', path: 'src/config.ts' }, 'change-request')

    const result = await publishBundleAndExportHandoff(workBundle, {})

    expect(result.ok).toBe(true)
    expect(result.handoff).toEqual({ written: false, skipped: 'no-repo-path' })
  })
})
