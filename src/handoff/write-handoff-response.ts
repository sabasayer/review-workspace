import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface HandoffResponseEntry {
  commentId: string
  status: 'addressed' | 'skipped'
  reason?: string
  whatIChanged?: string
}

export interface WriteHandoffResponseOptions {
  handoffFilePath: string
  mrNumber: string
  round: number
  responses: HandoffResponseEntry[]
}

/**
 * Writes an implementer's per-comment response as `<mr-number>-round<N>.response.json`
 * next to the hand-off file it corresponds to (same `.review-feedback/` directory).
 * Pure serialization — no git or LLM behavior lives here.
 */
export function writeHandoffResponse(options: WriteHandoffResponseOptions): string {
  const { handoffFilePath, mrNumber, round, responses } = options
  const filePath = join(dirname(handoffFilePath), `${mrNumber}-round${round}.response.json`)
  writeFileSync(filePath, JSON.stringify(responses, null, 2) + '\n')
  return filePath
}
