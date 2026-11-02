import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const ENTRY = '.review-feedback/'

function resolveExcludePath(repoPath: string): string | undefined {
  try {
    const output = execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return resolve(repoPath, output.trim())
  } catch {
    return undefined
  }
}

/**
 * Lists `.review-feedback/` in the repo's local `.git/info/exclude`, so the
 * hand-off file never shows up as a change and the tracked `.gitignore` is
 * never edited. Returns false when `repoPath` is not a git repo.
 */
export function ensureGitExcludesHandoff(repoPath: string): boolean {
  const excludePath = resolveExcludePath(repoPath)
  if (!excludePath) return false

  const content = existsSync(excludePath) ? readFileSync(excludePath, 'utf-8') : ''
  if (content.split('\n').some((line) => line.trim() === ENTRY)) return true

  const withTrailingNewline = content === '' || content.endsWith('\n') ? content : `${content}\n`
  mkdirSync(dirname(excludePath), { recursive: true })
  writeFileSync(excludePath, `${withTrailingNewline}${ENTRY}\n`)
  return true
}
