import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupPathFor } from './backup.ts'
import { publishBundle } from './publish.ts'

const fixtureBundle = fileURLToPath(new URL('../../fixtures/bundles/valid/', import.meta.url))

let workBundle: string
let backupRoot: string

beforeEach(() => {
  workBundle = mkdtempSync(join(tmpdir(), 'review-workspace-publish-'))
  cpSync(fixtureBundle, workBundle, { recursive: true })
  backupRoot = mkdtempSync(join(tmpdir(), 'review-workspace-publish-backups-'))
})

afterEach(() => {
  rmSync(workBundle, { recursive: true, force: true })
  rmSync(backupRoot, { recursive: true, force: true })
})

describe('publishBundle', () => {
  it('fails when review.next.json does not exist', () => {
    const result = publishBundle(workBundle)
    expect(result.ok).toBe(false)
    expect(result.blockingReason).toBe('missing-next')
  })

  it('returns the diagnostics of the staged document', () => {
    const staged = {
      schemaVersion: 1,
      comparison: { base: 'abc1111', head: 'def2222' },
      annotations: [{ id: 'an-1', target: { type: 'binary', path: 'shots/page.png' }, summary: 'Page changed.' }],
    }
    writeFileSync(join(workBundle, 'review.next.json'), JSON.stringify(staged))

    const result = publishBundle(workBundle)

    expect(result.ok).toBe(true)
    expect(result.diagnostics).toContainEqual({ kind: 'image-without-comparison', path: 'shots/page.png' })
  })

  it('atomically replaces review.json on a valid staged update', () => {
    const originalReviewJson = readFileSync(join(workBundle, 'review.json'), 'utf-8')
    const staged = {
      schemaVersion: 1,
      comparison: { base: 'abc1111', head: 'def2222' },
      annotations: [
        {
          id: 'an-1',
          target: { type: 'file', path: 'src/auth/login.ts' },
          summary: 'Newly published annotation',
        },
      ],
    }
    writeFileSync(join(workBundle, 'review.next.json'), JSON.stringify(staged, null, 2))

    const result = publishBundle(workBundle)

    expect(result.ok).toBe(true)
    const published = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    expect(published.annotations).toHaveLength(1)
    expect(published).not.toEqual(JSON.parse(originalReviewJson))
  })

  it('leaves review.json untouched when the staged update fails validation', () => {
    const originalReviewJson = readFileSync(join(workBundle, 'review.json'), 'utf-8')
    writeFileSync(join(workBundle, 'review.next.json'), '{ not valid json')

    const result = publishBundle(workBundle)

    expect(result.ok).toBe(false)
    expect(result.blockingReason).toBe('unparseable-json')
    expect(readFileSync(join(workBundle, 'review.json'), 'utf-8')).toBe(originalReviewJson)
  })

  it('leaves review.json untouched when the staged update has bad Targets/schema and blocks', () => {
    const originalReviewJson = readFileSync(join(workBundle, 'review.json'), 'utf-8')
    writeFileSync(join(workBundle, 'review.next.json'), JSON.stringify({ schemaVersion: 999 }))

    const result = publishBundle(workBundle)

    expect(result.ok).toBe(false)
    expect(result.blockingReason).toBe('unsupported-schema-version')
    expect(readFileSync(join(workBundle, 'review.json'), 'utf-8')).toBe(originalReviewJson)
  })

  describe('backup (third argument is the backup root)', () => {
    const stagedDoc = {
      schemaVersion: 1,
      comparison: { base: 'abc1111', head: 'def2222' },
      annotations: [{ id: 'an-1', target: { type: 'file', path: 'src/auth/login.ts' }, summary: 'Published.' }],
    }

    it('backs up the bundle after a successful publish', () => {
      writeFileSync(join(workBundle, 'review.next.json'), JSON.stringify(stagedDoc))

      const result = publishBundle(workBundle, undefined, backupRoot)

      expect(result.ok).toBe(true)
      const copy = backupPathFor(workBundle, backupRoot)
      const backedUp = JSON.parse(readFileSync(join(copy, 'review.json'), 'utf-8'))
      expect(backedUp.annotations).toHaveLength(1)
    })

    it('makes no backup when the publish fails', () => {
      writeFileSync(join(workBundle, 'review.next.json'), '{ not valid json')

      const result = publishBundle(workBundle, undefined, backupRoot)

      expect(result.ok).toBe(false)
      expect(existsSync(backupPathFor(workBundle, backupRoot))).toBe(false)
    })

    it('still succeeds when the backup fails', () => {
      writeFileSync(join(workBundle, 'review.next.json'), JSON.stringify(stagedDoc))
      const blocker = join(backupRoot, 'blocker')
      writeFileSync(blocker, 'a file, not a folder')
      const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      try {
        const result = publishBundle(workBundle, undefined, join(blocker, 'backups'))
        expect(result.ok).toBe(true)
        expect(JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8')).annotations).toHaveLength(1)
        expect(spy.mock.calls.some(([chunk]) => String(chunk).includes('Backup failed for'))).toBe(true)
      } finally {
        spy.mockRestore()
      }
    })
  })
})
