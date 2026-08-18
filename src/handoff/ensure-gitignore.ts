import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENTRY = '.review-feedback/'
const COVERING_PATTERNS = new Set(['.review-feedback/', '.review-feedback', '.review-feedback/**', '.review-feedback/*'])

function lineCoversHandoffDir(line: string): boolean {
  return COVERING_PATTERNS.has(line.trim())
}

/**
 * Ensures the target repo's `.gitignore` excludes `.review-feedback/` —
 * creating the file if it doesn't exist, appending the entry if the file
 * exists but neither an exact nor a broader matching entry already covers it.
 */
export function ensureGitignoreExcludesHandoff(repoPath: string): void {
  const gitignorePath = join(repoPath, '.gitignore')

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${ENTRY}\n`)
    return
  }

  const content = readFileSync(gitignorePath, 'utf-8')
  if (content.split('\n').some(lineCoversHandoffDir)) return

  const withTrailingNewline = content.endsWith('\n') ? content : `${content}\n`
  writeFileSync(gitignorePath, `${withTrailingNewline}${ENTRY}\n`)
}
