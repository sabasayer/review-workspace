import { reactive } from 'vue'

// Module-level (not per-component), mirrors expanded-hunks-store.ts. Only holds
// explicit user overrides — the default (collapsed if huge, expanded otherwise) is
// computed by the caller from the file's own size and isn't known here.
const overrides = reactive(new Map<string, boolean>())

export function isFileCollapsed(path: string, defaultCollapsed: boolean): boolean {
  return overrides.get(path) ?? defaultCollapsed
}

export function toggleFile(path: string, currentlyCollapsed: boolean): void {
  overrides.set(path, !currentlyCollapsed)
}
