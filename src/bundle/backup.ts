import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, realpathSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

export const DEFAULT_BACKUP_ROOT =
  process.env.REVIEW_WORKSPACE_BACKUP_ROOT ?? join(homedir(), '.claude', 'review-workspace-backups')

const SKIPPED_FILES = ['.write-token', 'watcher.json']

export type BackupResult = { ok: true; path: string } | { ok: false; message: string }

export function backupPathFor(bundlePath: string, root: string = DEFAULT_BACKUP_ROOT): string {
  const absolute = resolve(bundlePath)
  const hash = createHash('sha1').update(absolute).digest('hex').slice(0, 8)
  return join(root, `${basename(absolute)}-${hash}`)
}

export function backupBundle(bundlePath: string, root: string = DEFAULT_BACKUP_ROOT): BackupResult {
  const absolute = resolve(bundlePath)
  const destination = backupPathFor(absolute, root)
  const staging = `${destination}.tmp`
  const previous = `${destination}.old`
  try {
    const source = realpathSync(absolute)
    mkdirSync(root, { recursive: true })
    rmSync(staging, { recursive: true, force: true })
    if (existsSync(previous)) {
      if (existsSync(destination)) rmSync(previous, { recursive: true, force: true })
      else renameSync(previous, destination)
    }
    if (!existsSync(join(source, 'review.json'))) {
      return { ok: false, message: 'review.json is missing, so the last backup was kept' }
    }
    const skipped = SKIPPED_FILES.map((name) => join(source, name))
    cpSync(source, staging, { recursive: true, dereference: true, filter: (path) => !skipped.includes(path) })
    const hadBackup = existsSync(destination)
    if (hadBackup) renameSync(destination, previous)
    try {
      renameSync(staging, destination)
    } catch (err) {
      if (hadBackup) renameSync(previous, destination)
      throw err
    }
    rmSync(previous, { recursive: true, force: true })
    return { ok: true, path: destination }
  } catch (err) {
    rmSync(staging, { recursive: true, force: true })
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export function backupOrWarn(bundlePath: string, root?: string): void {
  const result = backupBundle(bundlePath, root)
  if (!result.ok) process.stderr.write(`Backup failed for ${bundlePath}: ${result.message}\n`)
}
