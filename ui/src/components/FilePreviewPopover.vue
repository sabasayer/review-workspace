<script setup lang="ts">
import { computed } from 'vue'
import { highlightCode } from '../highlight.ts'
import { placePopover } from '../file-preview-position.ts'
import { previewState } from '../composables/file-preview-store.ts'
import { useFilePreviewEvents } from '../composables/useFilePreviewEvents.ts'
import DiffLinesPreview from './DiffLinesPreview.vue'

useFilePreviewEvents()

const POPOVER_WIDTH = 520

const style = computed(() => {
  const anchor = previewState.anchor
  if (!anchor) return {}
  const place = placePopover(anchor, { width: window.innerWidth, height: window.innerHeight }, POPOVER_WIDTH)
  return {
    left: `${place.left}px`,
    top: place.top === undefined ? undefined : `${place.top}px`,
    bottom: place.bottom === undefined ? undefined : `${place.bottom}px`,
  }
})
</script>

<template>
  <div
    v-if="previewState.body"
    id="file-preview"
    role="tooltip"
    data-file-preview
    data-testid="file-preview"
    class="fixed z-50 max-h-80 w-[520px] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-default bg-default p-2 shadow-lg"
    :style="style"
  >
    <p class="mb-1 truncate font-mono text-xs font-semibold text-highlighted">{{ previewState.body.path }}</p>
    <template v-if="previewState.body.kind === 'diff'">
      <DiffLinesPreview :lines="previewState.body.lines" />
      <p class="mt-1 text-[11px] text-muted">First lines of the change. Ctrl+click to open</p>
    </template>
    <template v-else>
      <div class="max-w-full overflow-x-auto rounded border border-default bg-default p-1.5 font-mono text-[10px]" data-testid="file-preview-code">
        <div v-for="(text, i) in previewState.body.lines" :key="i" class="whitespace-pre"><code v-html="highlightCode(text)"></code></div>
      </div>
      <p class="mt-1 text-[11px] text-muted">
        Top of the file{{ previewState.body.truncated ? ' (first lines only)' : '' }}. Not in the diff, so Ctrl+click does nothing
      </p>
    </template>
  </div>
</template>
