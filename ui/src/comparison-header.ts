import { renderMarkdown } from './markdown.ts'
import type { Comparison } from './types.ts'

export function hasMrMetadata(comparison: Comparison | undefined): boolean {
  return !!comparison && !!(comparison.title || comparison.url || comparison.author || comparison.sourceBranch || comparison.description)
}

export function formatHeaderTitle(comparison: Comparison | undefined): string {
  if (!comparison) return 'Review Workspace'
  if (comparison.title) return comparison.number ? `!${comparison.number} ${comparison.title}` : comparison.title
  return `${comparison.base} → ${comparison.head}`
}

export function renderComparisonDescription(comparison: Comparison | undefined): string {
  if (!comparison?.description) return ''
  return renderMarkdown(comparison.description, comparison.url)
}
