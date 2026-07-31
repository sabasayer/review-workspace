<script setup lang="ts">
import type { RenderedGroup } from '../types.ts'

defineProps<{ groups: Array<{ group: RenderedGroup | null; filePaths: string[] }> }>()

function anchorId(path: string): string {
  return `file-${path.replace(/[^a-zA-Z0-9]/g, '-')}`
}

function shortName(path: string): string {
  return path.split('/').pop() ?? path
}

function jump(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const riskColor: Record<string, 'error' | 'warning' | 'success'> = { high: 'error', medium: 'warning', low: 'success' }
</script>

<template>
  <nav class="flex flex-col gap-4">
    <div v-for="(entry, i) in groups" :key="entry.group?.id ?? `ungrouped-${i}`">
      <div class="mb-1 flex items-center gap-2">
        <span v-if="entry.group" class="text-xs font-semibold text-highlighted">{{ entry.group.title }}</span>
        <span v-else class="text-xs font-semibold text-muted">Other changes</span>
        <UBadge v-if="entry.group?.risk" :color="riskColor[entry.group.risk]" variant="subtle" size="sm">
          {{ entry.group.risk }}
        </UBadge>
      </div>
      <p v-if="entry.group?.description" class="mb-2 text-xs text-muted">{{ entry.group.description }}</p>
      <div class="flex flex-col gap-1">
        <button
          v-for="path in entry.filePaths"
          :key="path"
          type="button"
          class="truncate rounded px-2 py-1 text-left font-mono text-xs text-muted hover:bg-elevated hover:text-highlighted"
          :title="path"
          @click="jump(path)"
        >
          {{ shortName(path) }}
        </button>
      </div>
    </div>
  </nav>
</template>
