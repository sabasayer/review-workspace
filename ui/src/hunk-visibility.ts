export const HUNK_LINE_THRESHOLD = 50

export function visibleSlice<T>(expanded: boolean, lines: T[], threshold = HUNK_LINE_THRESHOLD): T[] {
  return expanded || lines.length <= threshold ? lines : lines.slice(0, threshold)
}

export function hiddenLineCount(expanded: boolean, lines: unknown[], threshold = HUNK_LINE_THRESHOLD): number {
  return expanded ? 0 : Math.max(0, lines.length - threshold)
}
