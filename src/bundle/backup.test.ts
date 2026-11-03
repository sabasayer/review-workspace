import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupBundle, backupPathFor } from './backup.ts'

let sandbox: string
let bundle: string
let root: string

function makeBundle(path: string, files: Record<string, string>) {
  mkdirSync(path, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(path, name, '..'), { recursive: true })
    writeFileSync(join(path, name), content)
  }
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'review-workspace-backup-'))
  bundle = join(sandbox, 'my-bundle')
  root = join(sandbox, 'backups')
  makeBundle(bundle, {
    'review.json': '{"v":1}',
    'questions.jsonl': 'q1\n',
    'assets/shot.png': 'png-bytes',
    '.write-token': 'secret',
    'watcher.json': '{"live":true}',
  })
})

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true })
})

describe('DEFAULT_BACKUP_ROOT', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses REVIEW_WORKSPACE_BACKUP_ROOT when it is set', async () => {
    vi.stubEnv('REVIEW_WORKSPACE_BACKUP_ROOT', join(sandbox, 'from-env'))
    vi.resetModules()

    const fresh = await import('./backup.ts')

    expect(fresh.DEFAULT_BACKUP_ROOT).toBe(join(sandbox, 'from-env'))
  })

  it('falls back to the home folder when it is not set', async () => {
    vi.stubEnv('REVIEW_WORKSPACE_BACKUP_ROOT', undefined)
    vi.resetModules()

    const fresh = await import('./backup.ts')

    expect(fresh.DEFAULT_BACKUP_ROOT.endsWith(join('.claude', 'review-workspace-backups'))).toBe(true)
  })
})

describe('backupPathFor', () => {
  it('puts the backup under the root as <bundle-name>-<8 hex chars>', () => {
    const path = backupPathFor(bundle, root)
    expect(path.startsWith(root)).toBe(true)
    expect(basename(path)).toMatch(/^my-bundle-[0-9a-f]{8}$/)
  })

  it('gives the same path for the same bundle and different paths for same-named bundles', () => {
    const other = join(sandbox, 'elsewhere', 'my-bundle')
    expect(backupPathFor(bundle, root)).toBe(backupPathFor(bundle, root))
    expect(backupPathFor(other, root)).not.toBe(backupPathFor(bundle, root))
  })
})

describe('backupBundle', () => {
  it('copies files and nested assets and returns the backup path', () => {
    const result = backupBundle(bundle, root)

    expect(result).toEqual({ ok: true, path: backupPathFor(bundle, root) })
    expect(readFileSync(join(backupPathFor(bundle, root), 'review.json'), 'utf-8')).toBe('{"v":1}')
    expect(readFileSync(join(backupPathFor(bundle, root), 'questions.jsonl'), 'utf-8')).toBe('q1\n')
    expect(readFileSync(join(backupPathFor(bundle, root), 'assets/shot.png'), 'utf-8')).toBe('png-bytes')
  })

  it('skips .write-token and watcher.json', () => {
    backupBundle(bundle, root)

    const copy = backupPathFor(bundle, root)
    expect(existsSync(join(copy, '.write-token'))).toBe(false)
    expect(existsSync(join(copy, 'watcher.json'))).toBe(false)
    expect(existsSync(join(copy, 'review.json'))).toBe(true)
  })

  it('replaces the old copy with the latest one and keeps no history', () => {
    backupBundle(bundle, root)
    rmSync(join(bundle, 'questions.jsonl'))
    writeFileSync(join(bundle, 'review.json'), '{"v":2}')

    backupBundle(bundle, root)

    const copy = backupPathFor(bundle, root)
    expect(readFileSync(join(copy, 'review.json'), 'utf-8')).toBe('{"v":2}')
    expect(existsSync(join(copy, 'questions.jsonl'))).toBe(false)
    expect(readdirSync(root)).toEqual([basename(copy)])
  })

  it('makes two folders for two bundles with the same name', () => {
    const other = join(sandbox, 'elsewhere', 'my-bundle')
    makeBundle(other, { 'review.json': '{"v":"other"}' })

    backupBundle(bundle, root)
    backupBundle(other, root)

    expect(readdirSync(root)).toHaveLength(2)
    expect(readFileSync(join(backupPathFor(bundle, root), 'review.json'), 'utf-8')).toBe('{"v":1}')
    expect(readFileSync(join(backupPathFor(other, root), 'review.json'), 'utf-8')).toBe('{"v":"other"}')
  })

  it('returns ok: false with a message and does not throw when the bundle is missing', () => {
    const result = backupBundle(join(sandbox, 'nope'), root)

    expect(result.ok).toBe(false)
    expect(result).toHaveProperty('message')
  })

  it('returns ok: false and does not throw when the root cannot be written', () => {
    const blocker = join(sandbox, 'blocker')
    writeFileSync(blocker, 'a file, not a folder')

    const result = backupBundle(bundle, join(blocker, 'backups'))

    expect(result.ok).toBe(false)
  })

  it.skipIf(process.getuid?.() === 0)('leaves the last good backup in place when a later copy fails', () => {
    backupBundle(bundle, root)
    const copy = backupPathFor(bundle, root)
    const unreadable = join(bundle, 'assets', 'shot.png')
    chmodSync(unreadable, 0o000)
    writeFileSync(join(bundle, 'review.json'), '{"v":2}')

    const result = backupBundle(bundle, root)
    chmodSync(unreadable, 0o644)

    expect(result.ok).toBe(false)
    expect(readFileSync(join(copy, 'review.json'), 'utf-8')).toBe('{"v":1}')
    expect(readFileSync(join(copy, 'assets/shot.png'), 'utf-8')).toBe('png-bytes')
  })

  it('makes a real copy when the bundle is a symlink', () => {
    const link = join(sandbox, 'linked-bundle')
    symlinkSync(bundle, link)

    const result = backupBundle(link, root)

    expect(result.ok).toBe(true)
    const copy = backupPathFor(link, root)
    expect(lstatSync(copy).isSymbolicLink()).toBe(false)
    expect(readFileSync(join(copy, 'review.json'), 'utf-8')).toBe('{"v":1}')
  })

  it('makes a real copy of a symlink inside the bundle', () => {
    const outside = join(sandbox, 'outside.png')
    writeFileSync(outside, 'outside-bytes')
    symlinkSync(outside, join(bundle, 'assets', 'linked.png'))

    backupBundle(bundle, root)

    const copied = join(backupPathFor(bundle, root), 'assets', 'linked.png')
    expect(lstatSync(copied).isSymbolicLink()).toBe(false)
    expect(readFileSync(copied, 'utf-8')).toBe('outside-bytes')
  })

  it('removes leftover temp folders and brings back an interrupted copy', () => {
    backupBundle(bundle, root)
    const copy = backupPathFor(bundle, root)
    mkdirSync(`${copy}.tmp`)
    writeFileSync(join(`${copy}.tmp`, 'junk'), 'junk')
    mkdirSync(`${copy}.old`)

    backupBundle(bundle, root)

    expect(readdirSync(root)).toEqual([basename(copy)])
  })

  it('restores the old copy when a crash left only the .old folder', () => {
    backupBundle(bundle, root)
    const copy = backupPathFor(bundle, root)
    renameSync(copy, `${copy}.old`)
    rmSync(join(bundle, 'review.json'))

    const result = backupBundle(bundle, root)

    expect(result.ok).toBe(false)
    expect(readdirSync(root)).toEqual([basename(copy)])
    expect(readFileSync(join(copy, 'review.json'), 'utf-8')).toBe('{"v":1}')
  })

  it('keeps the last good backup when review.json is missing from the source', () => {
    backupBundle(bundle, root)
    rmSync(join(bundle, 'review.json'))
    writeFileSync(join(bundle, 'questions.jsonl'), 'changed\n')

    const result = backupBundle(bundle, root)

    const copy = backupPathFor(bundle, root)
    expect(result.ok).toBe(false)
    expect(readFileSync(join(copy, 'review.json'), 'utf-8')).toBe('{"v":1}')
    expect(readFileSync(join(copy, 'questions.jsonl'), 'utf-8')).toBe('q1\n')
  })
})
