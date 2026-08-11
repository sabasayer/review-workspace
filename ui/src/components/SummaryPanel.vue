<script setup lang="ts">
import type { RenderedSummary } from '../types.ts'
import { anchorId } from '../diff-layout.ts'
import { renderMarkdown } from '../markdown.ts'

defineProps<{ summary: RenderedSummary }>()

function jump(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section role="region" aria-label="Summary" class="mb-6 rounded-lg border border-default bg-elevated p-4">
    <h2 class="mb-2 text-sm font-semibold">Summary</h2>
    <div class="markdown-body mb-3 text-sm text-muted" v-html="renderMarkdown(summary.text)" />

    <ul v-if="summary.highlightAnnotations.length" class="mb-2 space-y-1 text-xs">
      <li v-for="annotation in summary.highlightAnnotations" :key="annotation.id">
        <button type="button" class="font-mono text-primary hover:underline" @click="jump(annotation.target.path)">
          → {{ annotation.target.path }}
        </button>
        <span class="text-muted"> — {{ annotation.summary }}</span>
      </li>
    </ul>

    <ul v-if="summary.highlightPaths.length" class="flex flex-wrap gap-2 text-xs">
      <li v-for="path in summary.highlightPaths" :key="path">
        <button type="button" class="font-mono text-primary hover:underline" @click="jump(path)">→ {{ path }}</button>
      </li>
    </ul>
  </section>
</template>
