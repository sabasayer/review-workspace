import type { Target } from '../schema/types.ts'

export type CommentTargetResult = { ok: true; target: Target | undefined } | { ok: false; error: string }

const invalid = (detail: string): CommentTargetResult => ({ ok: false, error: `target is not valid: ${detail}` })

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value !== ''

function isWholeNumber(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min
}

export function parseCommentTarget(value: unknown): CommentTargetResult {
  if (value === undefined) return { ok: true, target: undefined }
  if (typeof value !== 'object' || value === null) return invalid('expected an object')

  const raw = value as Record<string, unknown>
  if (raw.type === 'general') return { ok: true, target: { type: 'general' } }
  if (!isNonEmptyString(raw.path)) return invalid('path is required')
  const path = raw.path

  switch (raw.type) {
    case 'file':
    case 'binary':
      return { ok: true, target: { type: raw.type, path } }
    case 'hunk':
      return isWholeNumber(raw.hunkIndex, 0)
        ? { ok: true, target: { type: 'hunk', path, hunkIndex: raw.hunkIndex } }
        : invalid('hunkIndex must be a whole number of 0 or more')
    case 'line':
      if (raw.side !== 'base' && raw.side !== 'head') return invalid('side must be base or head')
      if (!isWholeNumber(raw.line, 1)) return invalid('line must be a whole number of 1 or more')
      if (typeof raw.expectedText !== 'string') return invalid('expectedText is required')
      return { ok: true, target: { type: 'line', path, side: raw.side, line: raw.line, expectedText: raw.expectedText } }
    default:
      return invalid('unknown type')
  }
}
