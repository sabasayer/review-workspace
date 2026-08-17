import type { ReviewDocument } from '../schema/types.ts'
import type { ReviewState } from '../review-state/types.ts'

/**
 * A self-contained Markdown report — no server needed to view it afterward.
 * Read-only with respect to the bundle: never mutates state.json or questions.jsonl.
 */
export function buildReport(document: ReviewDocument, state: ReviewState): string {
  const lines: string[] = []
  lines.push('# Review Report')
  lines.push('')
  lines.push(`**Comparison:** ${document.comparison.base} → ${document.comparison.head}`)
  lines.push(`**Decision:** ${state.decision}`)
  lines.push('')

  lines.push('## Behavioral Groups')
  const groups = document.behavioralGroups ?? []
  if (groups.length === 0) {
    lines.push('_None declared._')
  } else {
    for (const group of [...groups].sort((a, b) => a.order - b.order)) {
      const progress = state.groups[group.id]
      lines.push(
        `- **${group.title}** — understood: ${progress?.understood ? 'yes' : 'no'}, verified: ${progress?.verified ? 'yes' : 'no'}`,
      )
    }
  }
  lines.push('')

  lines.push('## Notes')
  if (state.notes.length === 0) {
    lines.push('_None._')
  } else {
    for (const note of state.notes) lines.push(`- ${note}`)
  }

  return lines.join('\n') + '\n'
}
