<script setup lang="ts">
import type { PanelBadge } from '../question-panel.ts'

defineProps<{ badge: PanelBadge | null }>()
</script>

<template>
  <span
    v-if="badge"
    data-testid="panel-badge"
    :data-tone="badge.tone"
    role="status"
    class="pointer-events-none absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-sm font-bold leading-none"
    :class="badge.tone === 'new' ? 'bg-primary text-inverted' : 'bg-warning text-inverted'"
  >
    <span aria-hidden="true">{{ badge.text }}</span>
    <span class="sr-only">{{ badge.srText }}</span>
  </span>
</template>
