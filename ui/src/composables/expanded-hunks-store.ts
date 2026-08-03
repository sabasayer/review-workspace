import { reactive } from 'vue'

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
