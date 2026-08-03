<script setup lang="ts">
import { computed } from 'vue'
import type { Answer, Question, RenderedFile } from '../types.ts'
import { lineAnchorId, toSideBySideRows } from '../diff-layout.ts'
import { expandHunk, isHunkExpanded } from '../composables/expanded-hunks-store.ts'
import { highlightCode } from '../highlight.ts'
import { questionsForLine } from '../question-entries.ts'
import { hiddenLineCount, visibleSlice } from '../hunk-visibility.ts'
import { useSyncedScroll } from '../composables/useSyncedScroll.ts'
import DiffLineNote from './DiffLineNote.vue'
import QuestionThread from './QuestionThread.vue'

const props = defineProps<{
  file: RenderedFile
  annotationNumbers: Map<string, number>
  questions: readonly Question[]
  answers: readonly Answer[]
}>()

const { leftPane, rightPane, syncScroll } = useSyncedScroll()

const sideBySideRowsByHunk = computed(() => props.file.hunks.map((h) => toSideBySideRows(h.lines)))
const filePath = computed(() => props.file.path)

function isExpanded(hunkIndex: number): boolean {
  return isHunkExpanded(props.file.path, hunkIndex)
}

function visibleRows(hunkIndex: number) {
  return visibleSlice(isExpanded(hunkIndex), sideBySideRowsByHunk.value[hunkIndex])
}

function hiddenRows(hunkIndex: number): number {
  return hiddenLineCount(isExpanded(hunkIndex), sideBySideRowsByHunk.value[hunkIndex])
}
</script>

<template>
  <div class="font-mono text-xs">
    <div class="grid grid-cols-2 border-b border-default bg-elevated text-[10px] font-bold text-muted">
      <span class="px-3 py-1">Base · before</span>
      <span class="border-l border-default px-3 py-1">MR head · after</span>
    </div>
    <div class="grid grid-cols-2">
      <div ref="leftPane" class="min-w-0 overflow-x-auto" @scroll="syncScroll(leftPane, rightPane)">
        <template v-for="(hunk, hi) in file.hunks" :key="hi">
          <div class="table w-max min-w-full border-collapse">
            <div class="table-caption caption-top whitespace-nowrap bg-elevated px-3 py-1 text-primary">
              @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} @@
            </div>
            <div
              v-for="(row, ri) in visibleRows(hi)"
              :id="row.left && row.left !== row.right ? lineAnchorId(row.left.id) : undefined"
              :key="ri"
              class="group table-row"
              :class="{ 'bg-error/10': row.left?.kind === 'remove' }"
            >
              <span class="table-cell w-12 select-none px-2 text-right align-baseline text-dimmed">{{ row.left?.oldLine ?? '' }}</span>
              <span class="table-cell w-4 select-none text-center align-baseline text-error">{{ row.left?.kind === 'remove' ? '−' : '' }}</span>
              <span class="table-cell select-none px-1 align-baseline">
                <QuestionThread
                  v-if="row.left"
                  :target="{ type: 'line', path: filePath, side: 'base', line: row.left.oldLine!, expectedText: row.left.text }"
                  :questions="questionsForLine(questions, filePath, 'base', row.left.oldLine)"
                  :answers="answers"
                />
              </span>
              <span class="table-cell whitespace-pre px-2 align-baseline text-[var(--syntax-text)]">
                <template v-if="row.left">
                  <code v-html="highlightCode(row.left.text)"></code>
                  <DiffLineNote :annotations="row.left.annotations" :diagnostics="row.left.diagnostics" :numbers="annotationNumbers" />
                </template>
              </span>
            </div>
          </div>
          <button
            v-if="hiddenRows(hi)"
            type="button"
            class="w-full border-b border-default bg-elevated/50 px-3 py-1.5 text-left text-[10px] text-muted hover:text-default"
            @click="expandHunk(file.path, hi)"
          >
            ⋯ Show {{ hiddenRows(hi) }} more rows
          </button>
        </template>
      </div>
      <div ref="rightPane" class="min-w-0 overflow-x-auto border-l border-default" @scroll="syncScroll(rightPane, leftPane)">
        <template v-for="(hunk, hi) in file.hunks" :key="hi">
          <div class="table w-max min-w-full border-collapse">
            <div class="table-caption caption-top whitespace-nowrap bg-elevated px-3 py-1 text-primary">
              @@ +{{ hunk.newStart }},{{ hunk.newLines }} @@
            </div>
            <div
              v-for="(row, ri) in visibleRows(hi)"
              :id="row.right ? lineAnchorId(row.right.id) : undefined"
              :key="ri"
              class="group table-row"
              :class="{ 'bg-success/10': row.right?.kind === 'add' }"
            >
              <span class="table-cell w-12 select-none px-2 text-right align-baseline text-dimmed">{{ row.right?.newLine ?? '' }}</span>
              <span class="table-cell w-4 select-none text-center align-baseline text-success">{{ row.right?.kind === 'add' ? '+' : '' }}</span>
              <span class="table-cell select-none px-1 align-baseline">
                <QuestionThread
                  v-if="row.right"
                  :target="{ type: 'line', path: filePath, side: 'head', line: row.right.newLine!, expectedText: row.right.text }"
                  :questions="questionsForLine(questions, filePath, 'head', row.right.newLine)"
                  :answers="answers"
                />
              </span>
              <span class="table-cell whitespace-pre px-2 align-baseline text-[var(--syntax-text)]">
                <template v-if="row.right">
                  <code v-html="highlightCode(row.right.text)"></code>
                  <DiffLineNote :annotations="row.right.annotations" :diagnostics="row.right.diagnostics" :numbers="annotationNumbers" />
                </template>
              </span>
            </div>
          </div>
          <button
            v-if="hiddenRows(hi)"
            type="button"
            class="w-full border-b border-default bg-elevated/50 px-3 py-1.5 text-left text-[10px] text-muted hover:text-default"
            @click="expandHunk(file.path, hi)"
          >
            ⋯ Show {{ hiddenRows(hi) }} more rows
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
