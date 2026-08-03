import { useTemplateRef } from 'vue'

export function useSyncedScroll() {
  const leftPane = useTemplateRef<HTMLElement>('leftPane')
  const rightPane = useTemplateRef<HTMLElement>('rightPane')
  let syncing = false

  function syncScroll(from: HTMLElement | null, to: HTMLElement | null) {
    if (!from || !to || syncing) return
    syncing = true
    to.scrollLeft = from.scrollLeft
    syncing = false
  }

  return { leftPane, rightPane, syncScroll }
}
