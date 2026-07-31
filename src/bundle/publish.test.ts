import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { publishBundle } from './publish.ts'

const fixtureBundle = fileURLToPath(new URL('../../fixtures/bundles/valid/', import.meta.url))

let workBundle: string

beforeEach(() => {
  workBundle = mkdtempSync(join(tmpdir(), 'review-workspace-publish-'))
  cpSync(fixtureBundle, workBundle, { recursive: true })
})

afterEach(() => {
  rmSync(workBundle, { recursive: true, force: true })
})

describe('publishBundle', () => {
  it('fails when review.next.json does not exist', () => {
    const result = publishBundle(workBundle)
    expect(result.ok).toBe(false)
    expect(result.blockingReason).toBe('missing-next')
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
})
