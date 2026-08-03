import { onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchView } from '../api.ts'
import { loadQuestions } from './questions-store.ts'
import { currentFiles } from './view-model-store.ts'
import type { ViewModel } from '../types.ts'

const POLL_INTERVAL_MS = 4000

export function useReviewView() {
  const viewModel = ref<ViewModel | null>(null)
  const error = ref<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | undefined

  async function refresh() {
    try {
      viewModel.value = await fetchView()
      currentFiles.value = viewModel.value.files
      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
    await loadQuestions()
  }

  onMounted(async () => {
    await refresh()
    pollTimer = setInterval(refresh, POLL_INTERVAL_MS)
  })

  onBeforeUnmount(() => clearInterval(pollTimer))

  return { viewModel, error, refresh }
}
