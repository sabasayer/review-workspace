<script setup lang="ts">
import type { RenderedLine } from '../types.ts'
import { highlightCode } from '../highlight.ts'

defineProps<{ lines: readonly RenderedLine[] }>()
</script>

<template>
  <div class="max-w-full overflow-x-auto rounded border border-default bg-default p-1.5 font-mono text-[10px]">
    <div
      v-for="line in lines"
      :key="line.id"
      class="whitespace-pre"
      :class="{ 'bg-success/10': line.kind === 'add', 'bg-error/10': line.kind === 'remove' }"
    >
      <span class="mr-1.5 select-none text-dimmed">{{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' ' }}</span
      ><code v-html="highlightCode(line.text)"></code>
    </div>
  </div>
</template>
