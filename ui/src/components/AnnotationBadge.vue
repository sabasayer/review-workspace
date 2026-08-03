<script setup lang="ts">
import { ref } from 'vue'
import type { Annotation } from '../types.ts'
import { anchorId } from '../diff-layout.ts'
import { renderMarkdown } from '../markdown.ts'
import { highlightCode } from '../highlight.ts'
import { resolveTargetPreview } from '../target-preview.ts'
import { currentFiles } from '../composables/view-model-store.ts'

const props = defineProps<{ annotation: Annotation; number: number }>()

// Deliberately doesn't close the popover before scrolling — Reka UI's FocusScope
// restores focus to this badge on close (for a11y), and closing first meant fighting
// its internal unmount timing (a setTimeout, not a microtask a simple nextTick() could
// wait out) to stop that restore's own scroll from undoing ours. Simpler and robust:
// leave it open. The popover tracks its trigger's position, so once we scroll away
// from this badge it just scrolls out of view with it — closing it explicitly buys
// nothing worth the race.
function goToRelatedTarget(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Inline expand-on-hover rather than a second floating popover nested inside this one —
// a nested overlay risks being treated as "outside" the note popover's own dismiss logic.
const hoveredIndex = ref<number | null>(null)

function previewFor(i: number) {
  const related = props.annotation.relatedTargets?.[i]
  return related ? resolveTargetPreview(currentFiles.value, related.target) : null
}
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
    <template #content>
      <div class="w-80 max-h-96 overflow-y-auto p-3 text-left font-sans text-xs whitespace-normal break-words normal-case select-text">
        <span class="mb-1.5 flex items-center gap-2">
          <UBadge size="sm" variant="subtle" color="primary">{{ annotation.kind ?? 'note' }}</UBadge>
        </span>
        <div class="markdown-body text-muted" v-html="renderMarkdown(annotation.summary)" />
        <ul v-if="annotation.relatedTargets?.length" class="mt-2 space-y-1 border-t border-default pt-2">
          <li
            v-for="(related, i) in annotation.relatedTargets"
            :key="i"
            class="leading-relaxed"
            @mouseenter="hoveredIndex = i"
            @mouseleave="hoveredIndex = null"
          >
            <button
              type="button"
              class="font-mono text-primary hover:underline"
              @click="goToRelatedTarget(related.target.path)"
            >
              → {{ related.target.path }}
            </button>
            <span class="text-muted"> — {{ related.reason }}</span>
            <div
              v-if="hoveredIndex === i && previewFor(i)"
              class="mt-1 max-w-full overflow-x-auto rounded border border-default bg-elevated p-1.5 font-mono text-[10px] normal-case"
            >
              <div
                v-for="line in previewFor(i)!.lines"
                :key="line.id"
                class="whitespace-pre"
                :class="{ 'bg-success/10': line.kind === 'add', 'bg-error/10': line.kind === 'remove' }"
              >
                <span class="mr-1.5 select-none text-dimmed">{{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' ' }}</span
                ><code v-html="highlightCode(line.text)"></code>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </UPopover>
</template>
