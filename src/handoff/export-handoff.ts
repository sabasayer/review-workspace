import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isOpenChangeRequest } from '../questions/questions-log.ts'
import type { Comment } from '../questions/types.ts'
import { reviewKey } from '../schema/review-key.ts'
import type { Annotation, Comparison } from '../schema/types.ts'
import { buildHandoffMarkdown } from './build-handoff-markdown.ts'
import { ensureGitExcludesHandoff } from './ensure-git-exclude.ts'

export interface ExportHandoffOptions {
  bundlePath: string
  comparison: Comparison
  round: number
  comments: Comment[]
  annotations: Annotation[]
  repoPath?: string
}

export interface ExportHandoffResult {
  written: boolean
  skipped?: 'no-repo-path' | 'not-a-git-repo' | 'no-review-key'
  filePath?: string
  repoPath?: string
}

/**
 * Exports open change-request Comments as a self-describing hand-off
 * Markdown file into the target repo's local working tree, and lists
 * `.review-feedback/` in that repo's `.git/info/exclude`. A no-op when there
 * are no open change-requests — this is what makes it safe to call after
 * every publish. Never prompts: without a usable repo path it skips.
 */
export async function exportHandoff(options: ExportHandoffOptions): Promise<ExportHandoffResult> {
  const { bundlePath, comparison, round, comments, annotations, repoPath } = options
  const hasOpenChangeRequest = comments.some(isOpenChangeRequest)
  if (!hasOpenChangeRequest) return { written: false }

  if (!repoPath) return { written: false, skipped: 'no-repo-path' }
  const key = reviewKey(comparison)
  if (!key) return { written: false, skipped: 'no-review-key' }
  if (!ensureGitExcludesHandoff(repoPath)) return { written: false, skipped: 'not-a-git-repo' }

  const markdown = buildHandoffMarkdown({ bundlePath, comparison, round, comments, annotations })
  const feedbackDir = join(repoPath, '.review-feedback')
  mkdirSync(feedbackDir, { recursive: true })
  const filePath = join(feedbackDir, `${key}-round${round}.md`)
  writeFileSync(filePath, markdown)

  return { written: true, filePath, repoPath }
}
