<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  jobName: string
  status: 'success' | 'failed' | 'running' | 'canceled' | 'skipped'
  url: string
  logExcerpt?: string
  description: string
}>()

const STATUS_COLOR: Record<typeof props.status, 'success' | 'error' | 'info' | 'neutral' | 'warning'> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  canceled: 'neutral',
  skipped: 'neutral',
}

const logOpen = ref(false)
</script>

<template>
  <div class="border-t border-default p-4 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <UBadge size="sm" variant="subtle" :color="STATUS_COLOR[status]">{{ status }}</UBadge>
      <a :href="url" target="_blank" rel="noopener" class="font-mono text-xs text-primary hover:underline">{{ jobName }}</a>
      <UButton v-if="logExcerpt" size="xs" variant="ghost" class="ml-auto" @click="logOpen = !logOpen">
        {{ logOpen ? 'Hide log' : 'Show log' }}
      </UButton>
    </div>
    <p class="mt-2 text-xs text-muted">{{ description }}</p>
    <pre v-if="logOpen && logExcerpt" class="mt-2 overflow-x-auto rounded bg-elevated p-2 font-mono text-xs whitespace-pre-wrap">{{
      logExcerpt
    }}</pre>
  </div>
</template>
