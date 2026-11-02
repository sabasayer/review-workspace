import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, resolve, sep } from 'node:path'

export const MAX_REPO_FILE_BYTES = 256 * 1024
const DEFAULT_LINES = 40
const MAX_LINES = 200

export type RepoFileRefusal = 'no-repo' | 'unsafe-path' | 'not-found' | 'not-a-file' | 'too-large' | 'not-text'

export type RepoFileResult =
  | { ok: true; path: string; content: string; truncated: boolean }
  | { ok: false; reason: RepoFileRefusal }

function clampLines(lines: number): number {
  if (!Number.isFinite(lines) || lines < 1) return DEFAULT_LINES
  return Math.min(Math.floor(lines), MAX_LINES)
}

function isUnsafeRelativePath(relativePath: string): boolean {
  if (relativePath === '' || relativePath.includes('\0')) return true
  if (isAbsolute(relativePath)) return true
  return relativePath.split(/[\\/]/).includes('..')
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(root + sep)
}

/** Reads the top lines of one text file inside the repo checkout. Read-only; refuses anything that leaves the repo, also through symlinks. */
export function readRepoFileTop(repoPath: string | undefined, relativePath: string, lines: number): RepoFileResult {
  if (!repoPath) return { ok: false, reason: 'no-repo' }
  if (isUnsafeRelativePath(relativePath)) return { ok: false, reason: 'unsafe-path' }

  const candidate = resolve(repoPath, relativePath)
  if (!existsSync(candidate)) return { ok: false, reason: 'not-found' }

  const realRoot = realpathSync(repoPath)
  const realFile = realpathSync(candidate)
  if (!isInside(realRoot, realFile)) return { ok: false, reason: 'unsafe-path' }

  const stats = statSync(realFile)
  if (!stats.isFile()) return { ok: false, reason: 'not-a-file' }
  if (stats.size > MAX_REPO_FILE_BYTES) return { ok: false, reason: 'too-large' }

  const buffer = readFileSync(realFile)
  if (buffer.includes(0)) return { ok: false, reason: 'not-text' }

  const allLines = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
  const wanted = clampLines(lines)
  return { ok: true, path: relativePath, content: allLines.slice(0, wanted).join('\n'), truncated: allLines.length > wanted }
}
