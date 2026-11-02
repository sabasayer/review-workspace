import type { RenderedFile, RenderedLine } from './types.ts'

export type FileRef = { kind: 'diff'; path: string } | { kind: 'outside'; path: string } | { kind: 'ambiguous' }

export const GLIMPSE_LINES = 12

const PATH_CHARS = /^[\w@.\-/+~]+$/
const HAS_EXTENSION = /\.[A-Za-z][A-Za-z0-9]{0,7}$/

function stripDotSlash(text: string): string {
  return text.startsWith('./') ? text.slice(2) : text
}

export function looksLikePath(text: string): boolean {
  const name = stripDotSlash(text)
  if (name === '' || !PATH_CHARS.test(name)) return false
  if (name.startsWith('/') || name.split('/').includes('..')) return false
  return name.includes('/') || HAS_EXTENSION.test(name)
}

export function resolveFileRef(text: string, changedPaths: readonly string[]): FileRef {
  const name = stripDotSlash(text)
  if (changedPaths.includes(name)) return { kind: 'diff', path: name }
  const suffixMatches = changedPaths.filter((path) => path.endsWith(`/${name}`))
  if (suffixMatches.length === 1) return { kind: 'diff', path: suffixMatches[0] }
  if (suffixMatches.length > 1) return { kind: 'ambiguous' }
  return { kind: 'outside', path: name }
}

export function diffGlimpse(file: RenderedFile): RenderedLine[] {
  if (file.binary) return []
  return file.hunks.flatMap((hunk) => hunk.lines).slice(0, GLIMPSE_LINES)
}

export function isJumpClick(event: { ctrlKey: boolean; metaKey: boolean; button: number }): boolean {
  return event.button === 0 && (event.ctrlKey || event.metaKey)
}
