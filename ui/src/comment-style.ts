import type { Question } from './types.ts'

/**
 * Shared visual language for Comment badges: a Question uses "?" in info blue, a
 * change-request uses "!" in error red (matching the badge-color convention already
 * used for status elsewhere in the UI), and a resolved change-request collapses to a
 * muted checkmark rather than disappearing.
 */
export function commentGlyph(comment: Question): string {
  if (comment.kind === 'change-request') return comment.resolved ? '✓' : '!'
  return '?'
}

export function commentBadgeClasses(comment: Question): string {
  if (comment.status === 'withdrawn') {
    return 'border-dimmed/60 bg-dimmed/10 text-dimmed line-through'
  }
  if (comment.kind === 'change-request') {
    return comment.resolved
      ? 'border-success/60 bg-success/10 text-success opacity-70'
      : 'border-error/60 bg-error/15 text-error hover:bg-error hover:text-inverted'
  }
  return 'border-info/60 bg-info/15 text-info hover:bg-info hover:text-inverted'
}
