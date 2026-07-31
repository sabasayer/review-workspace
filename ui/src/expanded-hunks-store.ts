import { reactive } from 'vue'

// Module-level (not per-component) so the global Questions panel can force-expand a
// hunk in a DiffFile it doesn't own before scrolling to a line inside it.
const expanded = reactive(new Set<string>())

function key(path: string, hunkIndex: number): string {
  return `${path}#${hunkIndex}`
}

export function isHunkExpanded(path: string, hunkIndex: number): boolean {
  return expanded.has(key(path, hunkIndex))
}

export function expandHunk(path: string, hunkIndex: number): void {
  expanded.add(key(path, hunkIndex))
}
