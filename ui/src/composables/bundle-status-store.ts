import { ref } from 'vue'
import { fetchLiveHead, fetchWatcher } from '../api.ts'
import type { LiveHeadStatus, WatcherRead } from '../types.ts'

export const liveHeadStatus = ref<LiveHeadStatus | null>(null)
export const watcherRead = ref<WatcherRead | null>(null)
export const generatorPrompt = ref('')

export async function refreshBundleStatus(): Promise<void> {
  const [liveHead, watcher] = await Promise.allSettled([fetchLiveHead(), fetchWatcher()])
  if (liveHead.status === 'fulfilled') liveHeadStatus.value = liveHead.value
  if (watcher.status === 'fulfilled') watcherRead.value = watcher.value
}
