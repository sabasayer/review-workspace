import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Comment } from '../questions/types.ts'
import type { Annotation, Comparison } from '../schema/types.ts'
import { buildHandoffMarkdown } from './build-handoff-markdown.ts'
import { ensureGitignoreExcludesHandoff } from './ensure-gitignore.ts'
import { DEFAULT_REPO_PATH_CACHE_PATH, resolveRepoPath, type AskForRepoPath } from './repo-path-cache.ts'

export interface ExportHandoffOptions {
  bundlePath: string
  comparison: Comparison
  round: number
  comments: Comment[]
  annotations: Annotation[]
  ask: AskForRepoPath
  repoPathCachePath?: string
}

export interface ExportHandoffResult {
  written: boolean
  filePath?: string
  repoPath?: string
}

/**
 * Exports open change-request Comments as a self-describing hand-off
 * Markdown file into the target repo's local working tree, and ensures
 * `.review-feedback/` is gitignored there. A no-op when there are no open
 * change-requests — this is what makes it safe to call after every publish.
 */
export async function exportHandoff(options: ExportHandoffOptions): Promise<ExportHandoffResult> {
  const { bundlePath, comparison, round, comments, annotations, ask, repoPathCachePath } = options
  const hasOpenChangeRequest = comments.some((c) => c.kind === 'change-request' && c.status === 'open' && !c.resolved)
  if (!hasOpenChangeRequest) return { written: false }

  if (!comparison.repository) {
    throw new Error('comparison.repository is required to export a hand-off file')
  }

  const repoPath = await resolveRepoPath(comparison.repository, ask, repoPathCachePath ?? DEFAULT_REPO_PATH_CACHE_PATH)

  const markdown = buildHandoffMarkdown({ bundlePath, comparison, round, comments, annotations })
  const feedbackDir = join(repoPath, '.review-feedback')
  mkdirSync(feedbackDir, { recursive: true })
  const filePath = join(feedbackDir, `${comparison.number}-round${round}.md`)
  writeFileSync(filePath, markdown)

  ensureGitignoreExcludesHandoff(repoPath)

  return { written: true, filePath, repoPath }
}
