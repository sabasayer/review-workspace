import { reactive, ref } from 'vue'

const hoveredIds = ref<readonly string[]>([])
const openNoteIds = reactive(new Map<string, readonly string[]>())

export function setHoveredLines(ids: readonly string[]): void {
  hoveredIds.value = ids
}

export function setNoteOpen(noteId: string, lineIds: readonly string[], open: boolean): void {
  if (open) openNoteIds.set(noteId, lineIds)
  else openNoteIds.delete(noteId)
}

export function isLineHighlighted(lineId: string): boolean {
  if (hoveredIds.value.includes(lineId)) return true
  for (const ids of openNoteIds.values()) if (ids.includes(lineId)) return true
  return false
}
