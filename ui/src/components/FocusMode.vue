<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { Annotation, RenderedFile, RenderedGroup } from '../types.ts'
import AnnotationCard from './AnnotationCard.vue'
import { collectVerificationEntries, groupRiskLookup, startHere } from '../annotation-view.ts'

// `currentId` (a Verification item id, not a raw index) is owned by the parent
// and survives this component's own mount/unmount — Focus mode toggles off
// (e.g. "view diff for this item") and back on as a v-if, which would reset a
// plain local index ref to 0 every time. Position by id instead of index so
// "continue where I left off" holds even if the entry set is re-derived.
const props = defineProps<{ files: readonly RenderedFile[]; groups: readonly RenderedGroup[]; currentId?: string }>()
const emit = defineEmits<{ exit: [path: string | null]; 'update:currentId': [id: string] }>()

const annotationsById = computed(() => {
  const map = new Map<string, Annotation>()
  for (const f of props.files) for (const a of f.annotations) map.set(a.id, a)
  return map
})

const entries = computed(() => {
  const riskOf = groupRiskLookup(props.groups)
  return startHere(collectVerificationEntries(props.files), riskOf)
})

const index = computed(() => {
  const i = entries.value.findIndex((e) => e.verification.id === props.currentId)
  return i === -1 ? 0 : i
})
const current = computed(() => entries.value[index.value])
const currentAnnotation = computed(() => (current.value?.annotationId ? annotationsById.value.get(current.value.annotationId) : undefined))

function goTo(target: number) {
  const clamped = Math.min(Math.max(target, 0), entries.value.length - 1)
  const entry = entries.value[clamped]
  if (entry) emit('update:currentId', entry.verification.id)
}
function next() {
  goTo(index.value + 1)
}
function prev() {
  goTo(index.value - 1)
}

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
  if (target?.isContentEditable) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'j') next()
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'k') prev()
  if (e.key === 'Escape') emit('exit', null)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="!entries.length" class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
    <p class="text-lg font-semibold text-highlighted">Nothing needs attention</p>
    <p class="text-sm text-muted">Every Verification item in this bundle is already marked verified.</p>
    <button type="button" class="mt-2 text-sm text-primary hover:underline" @click="emit('exit', null)">Esc — exit focus mode</button>
  </div>

  <div v-else class="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8">
    <div class="w-full max-w-2xl">
      <div class="mb-3 flex items-center justify-between text-xs text-dimmed">
        <span>{{ index + 1 }} / {{ entries.length }} — ordered by risk</span>
        <button type="button" class="text-primary hover:underline" @click="emit('exit', null)">Esc — exit focus mode</button>
      </div>

      <AnnotationCard
        v-if="currentAnnotation"
        :annotation="currentAnnotation"
        :default-expanded="true"
        :jump-to-diff="(path) => emit('exit', path)"
      />
      <div v-else class="rounded-lg border border-default bg-elevated p-4 text-sm text-muted">
        {{ current?.verification.description }}
      </div>

      <button
        v-if="current"
        type="button"
        class="mt-3 text-sm font-medium text-primary hover:underline"
        @click="emit('exit', current.path)"
      >
        → view diff for this item
      </button>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="button"
        class="rounded-full border border-default px-4 py-1.5 text-sm hover:bg-elevated disabled:opacity-30"
        :disabled="index === 0"
        @click="prev"
      >
        ← prev
      </button>
      <button
        type="button"
        class="rounded-full border border-default px-4 py-1.5 text-sm hover:bg-elevated disabled:opacity-30"
        :disabled="index === entries.length - 1"
        @click="next"
      >
        next →
      </button>
    </div>
    <p class="text-[11px] text-dimmed">← → or j/k to step, Esc to exit</p>
  </div>
</template>
