<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Annotation } from '../types.ts'
import { anchorId } from '../diff-layout.ts'
import { renderMarkdown } from '../markdown.ts'
import { resolveTargetPreview } from '../target-preview.ts'
import { currentFiles } from '../composables/view-model-store.ts'
import { isNoteResolved, toggleNoteResolved } from '../composables/review-state-store.ts'
import AskQuestionForm from './AskQuestionForm.vue'
import DiffLinesPreview from './DiffLinesPreview.vue'
import { splitHeadline } from '../annotation-view.ts'

const props = withDefaults(
  defineProps<{
    annotation: Annotation
    defaultExpanded?: boolean
    /**
     * Overrides how "jump to diff"/related-target links navigate. The default
     * (scrollIntoView by anchor id) only works when the target file is actually
     * in the DOM — not true inside FocusMode, which replaces the whole file
     * list with this card. A parent in that situation should pass its own
     * handler (e.g. exit FocusMode, then scroll once the file list is back).
     */
    jumpToDiff?: (path: string) => void
  }>(),
  { defaultExpanded: false },
)

// A parent that steps through several Annotations (e.g. FocusMode) reuses this
// same component instance rather than remounting it, so headline/body and the
// open/closed detail state must react to `annotation` changing, not just be
// computed once at setup.
const split = computed(() => splitHeadline(props.annotation.summary))
const detailOpen = ref(props.defaultExpanded)
watch(
  () => props.annotation.id,
  () => {
    detailOpen.value = props.defaultExpanded
  },
)

const verificationIcon: Record<string, string> = { verified: '✓', gap: '⚑', unverified: '○' }
const verificationColor: Record<string, 'success' | 'error' | 'neutral'> = { verified: 'success', gap: 'error', unverified: 'neutral' }
const evidenceLabel: Record<string, string> = { observed: 'observed', 'author-claim': 'claim', inference: 'inference' }
const evidenceColor: Record<string, 'success' | 'warning' | 'neutral'> = { observed: 'success', 'author-claim': 'warning', inference: 'neutral' }

function jump(path: string) {
  if (props.jumpToDiff) {
    props.jumpToDiff(path)
    return
  }
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const hoveredIndex = ref<number | null>(null)
function previewFor(i: number) {
  const related = props.annotation.relatedTargets?.[i]
  return related ? resolveTargetPreview(currentFiles.value, related.target) : null
}

const resolved = computed(() => isNoteResolved(props.annotation.id))

// Shown inline instead of forcing a "→ jump to diff" navigation, which — inside
// FocusMode — meant leaving the walkthrough entirely just to see the code a note
// is about. Only resolves for `hunk`/`line` targets; a plain `file` target still
// has nothing more specific to preview.
const diffOpen = ref(false)
const mainPreview = computed(() => resolveTargetPreview(currentFiles.value, props.annotation.target))
watch(
  () => props.annotation.id,
  () => {
    diffOpen.value = false
  },
)
</script>

<template>
  <article class="rounded-lg border p-4" :class="resolved ? 'border-success bg-success/5' : 'border-default bg-elevated'">
    <div class="mb-1 flex flex-wrap items-start justify-between gap-2">
      <h3 class="text-sm font-semibold text-highlighted">{{ split.headline }}</h3>
      <span class="flex items-center gap-2">
        <UBadge v-if="annotation.kind" size="sm" variant="subtle" color="primary">{{ annotation.kind }}</UBadge>
        <UCheckbox
          :model-value="resolved"
          label="Resolved"
          size="sm"
          @update:model-value="toggleNoteResolved(annotation.id)"
        />
      </span>
    </div>

    <button
      v-if="split.body"
      type="button"
      class="mb-2 text-xs text-primary hover:underline"
      @click="detailOpen = !detailOpen"
    >
      {{ detailOpen ? '▾ hide detail' : '▸ detail' }}
    </button>
    <div v-if="detailOpen && split.body" class="markdown-body mb-3 text-sm text-muted" v-html="renderMarkdown(split.body)" />

    <ul v-if="annotation.verification.length" class="mb-3 space-y-1 text-xs">
      <li v-for="v in annotation.verification" :key="v.id" class="flex items-start gap-1.5">
        <span :class="`text-${verificationColor[v.status]}`">{{ verificationIcon[v.status] }}</span>
        <span class="text-muted">{{ v.description }}</span>
      </li>
    </ul>

    <div v-if="annotation.evidence.length" class="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span class="text-dimmed uppercase tracking-wide">Evidence</span>
      <UBadge
        v-for="e in annotation.evidence"
        :key="e.id"
        size="sm"
        variant="subtle"
        :color="evidenceColor[e.kind]"
        :title="e.description"
      >
        {{ e.pipeline?.jobName ?? evidenceLabel[e.kind] }} · {{ evidenceLabel[e.kind] }}
      </UBadge>
    </div>

    <ul v-if="annotation.relatedTargets?.length" class="mb-2 space-y-1 border-t border-default pt-2 text-xs">
      <li
        v-for="(related, i) in annotation.relatedTargets"
        :key="i"
        @mouseenter="hoveredIndex = i"
        @mouseleave="hoveredIndex = null"
      >
        <button type="button" class="font-mono text-primary hover:underline" @click="jump(related.target.path)">
          → {{ related.target.path }}
        </button>
        <span class="text-muted"> — {{ related.reason }}</span>
        <DiffLinesPreview v-if="hoveredIndex === i && previewFor(i)" class="mt-1" :lines="previewFor(i)!.lines" />
      </li>
    </ul>

    <div class="flex items-center gap-3">
      <button v-if="mainPreview" type="button" class="text-xs font-medium text-primary hover:underline" @click="diffOpen = !diffOpen">
        {{ diffOpen ? '▾ close diff preview' : '▸ preview diff' }}
      </button>
      <button type="button" class="text-xs font-medium text-primary hover:underline" @click="jump(annotation.target.path)">
        → jump to diff
      </button>
    </div>
    <DiffLinesPreview v-if="diffOpen && mainPreview" class="mt-2" :lines="mainPreview.lines" />

    <div class="mt-3 border-t border-default pt-2">
      <AskQuestionForm :target="annotation.target" :annotation="annotation" />
    </div>
  </article>
</template>
