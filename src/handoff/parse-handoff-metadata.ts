export interface HandoffMetadata {
  bundlePath: string
  repository: string
  mrNumber: string
  round: number
}

const METADATA_BLOCK = /<!--\s*review-workspace-handoff\s*([\s\S]*?)-->/

function field(block: string, key: string): string | undefined {
  const match = block.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'))
  return match?.[1]?.trim()
}

/**
 * Parses the `<!-- review-workspace-handoff ... -->` metadata block a hand-off
 * Markdown file carries (written by `buildHandoffMarkdown`) back into its
 * structured fields. Returns `undefined` for a missing block or a block
 * missing any required field, rather than a partially-filled result.
 */
export function parseHandoffMetadata(markdown: string): HandoffMetadata | undefined {
  const blockMatch = markdown.match(METADATA_BLOCK)
  if (!blockMatch) return undefined

  const block = blockMatch[1]
  const bundlePath = field(block, 'bundlePath')
  const repository = field(block, 'repository')
  const mrNumber = field(block, 'mrNumber')
  const roundText = field(block, 'round')
  if (!bundlePath || !repository || !mrNumber || !roundText) return undefined

  const round = Number(roundText)
  if (!Number.isInteger(round)) return undefined

  return { bundlePath, repository, mrNumber, round }
}
