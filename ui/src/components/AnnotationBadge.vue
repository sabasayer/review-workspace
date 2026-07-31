<script setup lang="ts">
import type { Annotation } from '../types.ts'
import { anchorId } from '../diff-layout.ts'

defineProps<{ annotation: Annotation; number: number }>()
</script>

<template>
  <UPopover class="ml-1 inline-grid align-middle">
    <button
      type="button"
      class="grid h-[18px] w-[18px] place-items-center rounded-full border border-warning/60 bg-warning/15 text-[10px] font-bold text-warning transition hover:scale-110 hover:bg-warning hover:text-inverted focus-visible:scale-110 focus-visible:bg-warning focus-visible:text-inverted focus-visible:outline-none"
      :aria-label="`Note ${number}: ${annotation.summary}`"
    >
      {{ number }}
    </button>
    <template #content="{ close }">
      <div class="w-80 max-h-96 overflow-y-auto p-3 text-left font-sans text-xs whitespace-normal break-words normal-case select-text">
        <span class="mb-1.5 flex items-center gap-2">
          <UBadge size="sm" variant="subtle" color="primary">{{ annotation.kind ?? 'note' }}</UBadge>
        </span>
        <p class="leading-relaxed text-muted">{{ annotation.summary }}</p>
        <ul v-if="annotation.relatedTargets?.length" class="mt-2 space-y-1 border-t border-default pt-2">
          <li v-for="(related, i) in annotation.relatedTargets" :key="i" class="leading-relaxed">
            <a :href="`#${anchorId(related.target.path)}`" class="font-mono text-primary hover:underline" @click="close">
              → {{ related.target.path }}
            </a>
            <span class="text-muted"> — {{ related.reason }}</span>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
