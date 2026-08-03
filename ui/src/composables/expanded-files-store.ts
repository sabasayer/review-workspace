import { reactive } from 'vue'

const overrides = reactive(new Map<string, boolean>())

export function isFileCollapsed(path: string, defaultCollapsed: boolean): boolean {
  return overrides.get(path) ?? defaultCollapsed
}

export function toggleFile(path: string, currentlyCollapsed: boolean): void {
  overrides.set(path, !currentlyCollapsed)
}
