<script setup lang="ts">
import { computed } from 'vue'
import type { Answer, Question, RenderedFile } from '../types.ts'
import { lineAnchorId } from '../diff-layout.ts'
import { expandHunk, isHunkExpanded } from '../composables/expanded-hunks-store.ts'
import { highlightCode } from '../highlight.ts'
import { buildLineTarget, questionsForLine } from '../question-entries.ts'
import { hiddenLineCount, visibleSlice } from '../hunk-visibility.ts'
import DiffLineNote from './DiffLineNote.vue'
import QuestionThread from './QuestionThread.vue'

const props = defineProps<{
  file: RenderedFile
  annotationNumbers: Map<string, number>
  questions: readonly Question[]
  answers: readonly Answer[]
}>()

function isExpanded(hunkIndex: number): boolean {
  return isHunkExpanded(props.file.path, hunkIndex)
}

function visibleHunkLines(hunkIndex: number) {
  const hunk = props.file.hunks[hunkIndex]
  return visibleSlice(isExpanded(hunkIndex), hunk.lines)
}

function hiddenLines(hunkIndex: number): number {
  return hiddenLineCount(isExpanded(hunkIndex), props.file.hunks[hunkIndex].lines)
}

const filePath = computed(() => props.file.path)
</script>

<template>
  <div class="overflow-x-auto font-mono text-xs">
    <template v-for="(hunk, hi) in file.hunks" :key="hi">
      <div class="table w-max min-w-full border-collapse">
        <div class="table-caption caption-top whitespace-nowrap bg-elevated px-3 py-1 text-primary">
          @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{ hunk.newStart }},{{ hunk.newLines }} @@
        </div>
        <div
          v-for="line in visibleHunkLines(hi)"
          :id="lineAnchorId(line.id)"
          :key="line.id"
          class="group table-row"
          :class="{ 'bg-success/10': line.kind === 'add', 'bg-error/10': line.kind === 'remove' }"
        >
          <span class="table-cell select-none px-2 text-right align-baseline text-dimmed">{{ line.oldLine ?? '' }}</span>
          <span class="table-cell select-none px-2 text-right align-baseline text-dimmed">{{ line.newLine ?? '' }}</span>
          <span
            class="table-cell select-none text-center align-baseline"
            :class="{ 'text-success': line.kind === 'add', 'text-error': line.kind === 'remove' }"
          >
            {{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : '' }}
          </span>
          <span class="table-cell select-none px-1 align-baseline">
            <QuestionThread
              :target="buildLineTarget(filePath, line.text, line.oldLine, line.newLine)"
              :questions="questionsForLine(questions, filePath, line.newLine !== undefined ? 'head' : 'base', line.newLine ?? line.oldLine)"
              :answers="answers"
            />
          </span>
          <span class="table-cell whitespace-pre px-2 align-baseline text-[var(--syntax-text)]">
            <code v-html="highlightCode(line.text)"></code>
            <DiffLineNote :annotations="line.annotations" :diagnostics="line.diagnostics" :numbers="annotationNumbers" />
          </span>
        </div>
      </div>
      <button
        v-if="hiddenLines(hi)"
        type="button"
        class="w-full border-b border-default bg-elevated/50 px-3 py-1.5 text-left text-[10px] text-muted hover:text-default"
        @click="expandHunk(file.path, hi)"
      >
        ⋯ Show {{ hiddenLines(hi) }} more lines
      </button>
    </template>
  </div>
</template>
