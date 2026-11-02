<script setup lang="ts">
import { computed } from 'vue'
import { staleBannerText } from '../bundle-status.ts'
import { generatorPrompt, liveHeadStatus } from '../composables/bundle-status-store.ts'
import { useCopyFeedback } from '../composables/useCopyFeedback.ts'
import { nextRoundPrompt } from '../prompts.ts'

const text = computed(() => staleBannerText(liveHeadStatus.value))
const { copied, copy } = useCopyFeedback()

function copyNextRoundPrompt() {
  const head = liveHeadStatus.value?.liveHead?.head
  if (head) copy(nextRoundPrompt(generatorPrompt.value, head))
}
</script>

<template>
  <div v-if="text" data-testid="stale-banner" class="mb-4 flex items-center gap-3 rounded border border-warning/50 bg-warning/10 p-3 text-sm">
    <span class="font-semibold">{{ text }}</span>
    <UButton size="xs" class="ml-auto" @click="copyNextRoundPrompt">{{ copied ? 'Copied!' : 'Copy next-round prompt' }}</UButton>
  </div>
</template>
