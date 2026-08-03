import type { RenderedFile } from './types.ts'

export const FILE_LINE_THRESHOLD = 300

export function countAdditions(file: RenderedFile): number {
  return file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.kind === 'add').length, 0)
}

export function countDeletions(file: RenderedFile): number {
  return file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.kind === 'remove').length, 0)
}

export function totalHunkLines(file: RenderedFile): number {
  return file.hunks.reduce((n, h) => n + h.lines.length, 0)
}

export function shouldCollapseLargeFile(file: RenderedFile, threshold = FILE_LINE_THRESHOLD): boolean {
  return !file.binary && totalHunkLines(file) > threshold
}
