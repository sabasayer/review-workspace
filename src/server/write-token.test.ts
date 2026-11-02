import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadWriteToken, WRITE_TOKEN_FILE } from './write-token.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'review-workspace-token-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadWriteToken', () => {
  it('mints a token and saves it in the bundle with owner-only permissions', () => {
    const token = loadWriteToken(dir)
    expect(token).toMatch(/^[0-9a-f]{48}$/)
    expect(readFileSync(join(dir, WRITE_TOKEN_FILE), 'utf-8').trim()).toBe(token)
    expect(statSync(join(dir, WRITE_TOKEN_FILE)).mode & 0o777).toBe(0o600)
  })

  it('returns the saved token on every later call', () => {
    expect(loadWriteToken(dir)).toBe(loadWriteToken(dir))
  })

  it('mints and saves a new token when rotation is requested', () => {
    const first = loadWriteToken(dir)
    const rotated = loadWriteToken(dir, { rotate: true })
    expect(rotated).not.toBe(first)
    expect(loadWriteToken(dir)).toBe(rotated)
  })

  it('replaces an empty token file', () => {
    writeFileSync(join(dir, WRITE_TOKEN_FILE), '\n')
    expect(loadWriteToken(dir)).toMatch(/^[0-9a-f]{48}$/)
  })

  it('tightens the permissions of an existing token file', () => {
    writeFileSync(join(dir, WRITE_TOKEN_FILE), 'abc123\n', { mode: 0o644 })
    expect(loadWriteToken(dir)).toBe('abc123')
    expect(statSync(join(dir, WRITE_TOKEN_FILE)).mode & 0o777).toBe(0o600)
  })
})
