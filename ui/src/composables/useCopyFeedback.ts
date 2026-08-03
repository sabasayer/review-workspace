import { ref } from 'vue'

export function useCopyFeedback(resetMs = 1500) {
  const copied = ref(false)
  let resetTimer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    copied.value = true
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => (copied.value = false), resetMs)
  }

  return { copied, copy }
}
