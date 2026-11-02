<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Annotation, Answer, Question } from '../types.ts'
import { anchorId } from '../diff-layout.ts'
import { renderMarkdown } from '../markdown.ts'
import { resolveTargetPreview } from '../target-preview.ts'
import { currentFiles } from '../composables/view-model-store.ts'
import { splitHeadline } from '../annotation-view.ts'
import { lineLabel, verdictColor, verdictLabel } from '../note-fields.ts'
import { lineIdsForTarget } from '../line-highlight.ts'
import { setHoveredLines, setNoteOpen } from '../composables/line-highlight-store.ts'
import { threadForNote } from '../question-entries.ts'
import { isNoteResolved, toggleNoteResolved } from '../composables/review-state-store.ts'
import AskQuestionForm from './AskQuestionForm.vue'
import NoteSuggestion from './NoteSuggestion.vue'
import JumpToTargetButton from './JumpToTargetButton.vue'
import NoteVerdict from './NoteVerdict.vue'
import PendingAnswer from './PendingAnswer.vue'
import DiffLinesPreview from './DiffLinesPreview.vue'

const props = defineProps<{
  annotation: Annotation
  number: number
  questions: readonly Question[]
  answers: readonly Answer[]
}>()

const open = ref(false)
const resolved = computed(() => isNoteResolved(props.annotation.id))
const split = computed(() => splitHeadline(props.annotation.summary))
const thread = computed(() => threadForNote(props.questions, props.annotation.target))

const targetLineIds = computed(() => lineIdsForTarget(currentFiles.value, props.annotation.target))

function toggleOpen() {
  open.value = !open.value
  setNoteOpen(props.annotation.id, targetLineIds.value, open.value)
}

onBeforeUnmount(() => setNoteOpen(props.annotation.id, [], false))

const hoveredIndex = ref<number | null>(null)

function previewFor(i: number) {
  const related = props.annotation.relatedTargets?.[i]
  return related ? resolveTargetPreview(currentFiles.value, related.target) : null
}

function jump(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function answerFor(questionId: string): Answer | undefined {
  return props.answers.find((a) => a.questionId === questionId)
}
</script>

<template>
  <div
    data-testid="inline-note"
    class="my-1 max-w-3xl whitespace-normal rounded border font-sans text-xs"
    :class="resolved ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'"
    @mouseenter="setHoveredLines(targetLineIds)"
    @mouseleave="setHoveredLines([])"
  >
    <div class="flex items-center">
    <button type="button" class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left" @click="toggleOpen">
      <span v-if="lineLabel(annotation.target)" data-testid="note-line-label" class="shrink-0 font-mono text-[10px] text-dimmed">
        {{ lineLabel(annotation.target) }}
      </span>
      <span class="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-warning/60 text-[10px] font-bold text-warning">
        {{ number }}
      </span>
      <UBadge v-if="annotation.verdict && !open" size="sm" variant="subtle" :color="verdictColor(annotation.verdict)" class="shrink-0">
        {{ verdictLabel(annotation.verdict) }}
      </UBadge>
      <span class="truncate">{{ split.headline }}</span>
      <span v-if="thread.length" class="ml-auto shrink-0 text-muted">{{ thread.length }} in thread</span>
      <span class="shrink-0 text-dimmed" :class="{ 'ml-auto': !thread.length }">{{ open ? '▾' : '▸' }}</span>
    </button>
    <JumpToTargetButton :target="annotation.target" class="mr-1 shrink-0" />
    </div>
    <div v-if="open" class="border-t border-warning/30 px-3 py-2">
      <NoteVerdict class="mb-1" :annotation="annotation" />
      <div class="markdown-body text-muted" v-html="renderMarkdown(annotation.summary)" />
      <NoteSuggestion :suggestion="annotation.suggestion" />
      <ul v-if="annotation.relatedTargets?.length" class="mt-2 space-y-1 border-t border-default pt-2">
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
      <ul v-if="thread.length" class="mt-2 space-y-2 border-t border-default pt-2">
        <li v-for="q in thread" :key="q.id">
          <p class="font-semibold">{{ q.body }}</p>
          <div v-if="answerFor(q.id)" class="markdown-body mt-1 text-muted" v-html="renderMarkdown(answerFor(q.id)!.body)" />
          <PendingAnswer v-else-if="q.kind === 'question'" class="mt-1" :question="q" />
        </li>
      </ul>
      <div class="mt-2 flex items-center gap-3 border-t border-control pt-2">
        <UCheckbox
          :model-value="resolved"
          label="Resolved"
          size="sm"
          :ui="{ base: 'ring-control' }"
          @update:model-value="toggleNoteResolved(annotation.id)"
        />
        <AskQuestionForm :target="annotation.target" :annotation="annotation" />
      </div>
    </div>
  </div>
</template>
