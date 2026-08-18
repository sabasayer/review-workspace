import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type AskForRepoPath = (repoSlug: string) => string | Promise<string>

export const DEFAULT_REPO_PATH_CACHE_PATH = join(homedir(), '.claude', 'review-workspace-repo-paths.json')

type RepoPathCache = Record<string, string>

function readCache(cachePath: string): RepoPathCache {
  if (!existsSync(cachePath)) return {}
  return JSON.parse(readFileSync(cachePath, 'utf-8')) as RepoPathCache
}

function writeCache(cachePath: string, cache: RepoPathCache): void {
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, JSON.stringify(cache, null, 2) + '\n')
}

/**
 * Resolves a target repo's local checkout path for `repoSlug`. Reuses a
 * cached answer as long as it still exists on disk; asks (via `ask`) and
 * caches the answer otherwise — this covers both "never asked before" and
 * "the cached checkout was moved or deleted" in the same branch.
 */
export async function resolveRepoPath(repoSlug: string, ask: AskForRepoPath, cachePath: string = DEFAULT_REPO_PATH_CACHE_PATH): Promise<string> {
  const cache = readCache(cachePath)
  const cached = cache[repoSlug]
  if (cached && existsSync(cached)) return cached

  const answer = await ask(repoSlug)
  writeCache(cachePath, { ...cache, [repoSlug]: answer })
  return answer
}
