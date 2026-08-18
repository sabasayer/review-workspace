import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AskForRepoPath } from '../handoff/repo-path-cache.ts'
import { exportHandoff, type ExportHandoffResult } from '../handoff/export-handoff.ts'
import { readQuestions } from '../questions/questions-log.ts'
import type { ReviewDocument } from '../schema/types.ts'
import { DEFAULT_LIMITS, type BundleLimits } from '../security/limits.ts'
import { publishBundle, type PublishResult } from './publish.ts'
import { readChain } from './round.ts'

export interface PublishWithHandoffOptions {
  limits?: BundleLimits
  ask: AskForRepoPath
  repoPathCachePath?: string
}

export interface PublishWithHandoffResult extends PublishResult {
  handoff?: ExportHandoffResult
}

/**
 * Publishes a bundle and, only once the publish itself succeeds, exports its
 * open change-request Comments as a hand-off file into the target repo's
 * working tree. The round number comes from `chain.json` when present
 * (round N>1), otherwise round 1 — independent of chaining, same as the
 * hand-off export itself.
 */
export async function publishBundleAndExportHandoff(bundlePath: string, options: PublishWithHandoffOptions): Promise<PublishWithHandoffResult> {
  const result = publishBundle(bundlePath, options.limits ?? DEFAULT_LIMITS)
  if (!result.ok) return result

  const document = JSON.parse(readFileSync(join(bundlePath, 'review.json'), 'utf-8')) as ReviewDocument
  const round = readChain(bundlePath)?.round ?? 1

  const handoff = await exportHandoff({
    bundlePath,
    comparison: document.comparison,
    round,
    comments: readQuestions(bundlePath),
    annotations: document.annotations ?? [],
    ask: options.ask,
    repoPathCachePath: options.repoPathCachePath,
  })

  return { ...result, handoff }
}
