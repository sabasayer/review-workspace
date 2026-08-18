import type { Question, ResolutionStatus } from './types.ts'

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

/** Badge color for a Comment's kind — change-request reads as error/red, question as info/blue. */
export function commentKindColor(comment: Question): 'error' | 'info' {
  return comment.kind === 'change-request' ? 'error' : 'info'
}

/** Badge label for a Comment's kind. */
export function commentKindLabel(comment: Question): string {
  return comment.kind === 'change-request' ? 'Change request' : 'Question'
}

/**
 * Badge color for a Comment's status. `hasAnswer` lets a Question that's been
 * answered read as success, same as a resolved change-request — pass it only where
 * that distinction is tracked (the slideover); omit it where it isn't (the inline thread).
 */
export function commentStatusColor(comment: Question, hasAnswer = false): 'success' | 'warning' | 'neutral' {
  if (comment.resolved || hasAnswer) return 'success'
  return comment.status === 'open' ? 'warning' : 'neutral'
}

/** Badge label for a Comment's status, matching {@link commentStatusColor}'s cases. */
export function commentStatusLabel(comment: Question, hasAnswer = false): string {
  if (comment.resolved) return 'Resolved'
  if (hasAnswer) return 'Answered'
  return comment.status === 'open' ? 'Open' : 'Withdrawn'
}

/**
 * A Resolution is evidence-backed but never authoritative (framework.md) — `target-gone`
 * reads as warning/distinct from the neutral "not addressed" case, since it means the
 * reviewer's original Target is no longer where they left it, not just unresolved.
 */
export function resolutionStatusColor(status: ResolutionStatus): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'claimed-addressed') return 'success'
  if (status === 'claimed-partial') return 'warning'
  if (status === 'target-gone') return 'error'
  return 'neutral'
}

export function resolutionStatusLabel(status: ResolutionStatus): string {
  switch (status) {
    case 'claimed-addressed':
      return 'Claimed addressed'
    case 'claimed-partial':
      return 'Claimed partial'
    case 'claimed-not-addressed':
      return 'Claimed not addressed'
    case 'target-gone':
      return 'Target gone'
  }
}
