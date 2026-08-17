import { ref } from 'vue'

interface CollapsibleComment {
  id: string
  resolved: boolean
}

/**
 * Tracks which resolved change-request Comments a reviewer has expanded. A resolved
 * Comment collapses by default (never disappears, just stays out of the way);
 * expanding one is purely local UI state, never anything persisted.
 */
export function useCollapsedComments() {
  const expandedIds = ref(new Set<string>())

  function isCollapsed(comment: CollapsibleComment): boolean {
    return comment.resolved && !expandedIds.value.has(comment.id)
  }

  function toggleExpanded(id: string): void {
    const next = new Set(expandedIds.value)
    next.has(id) ? next.delete(id) : next.add(id)
    expandedIds.value = next
  }

  return { isCollapsed, toggleExpanded }
}
