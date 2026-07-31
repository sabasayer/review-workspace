<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import type { Annotation, Answer, Question, RenderedFile } from '../types.ts'
import { anchorId, lineAnchorId, toSideBySideRows } from '../diff-layout.ts'
import { expandHunk, isHunkExpanded } from '../expanded-hunks-store.ts'
import { isFileCollapsed, toggleFile } from '../expanded-files-store.ts'
import { highlightCode } from '../highlight.ts'
import DiffLineNote from './DiffLineNote.vue'
import AnnotationBadge from './AnnotationBadge.vue'
import ImageDiff from './ImageDiff.vue'
import PipelineEvidence from './PipelineEvidence.vue'
import QuestionThread from './QuestionThread.vue'

const props = defineProps<{
  file: RenderedFile
  layout: 'inline' | 'side-by-side'
  annotationNumbers: Map<string, number>
  questions: readonly Question[]
  answers: readonly Answer[]
}>()

const additions = computed(() => props.file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.kind === 'add').length, 0))
const deletions = computed(() => props.file.hunks.reduce((n, h) => n + h.lines.filter((l) => l.kind === 'remove').length, 0))

// A file like pnpm-lock.yaml can be thousands of lines — collapsed by default so it
// doesn't dominate the review, one click away either way via the header toggle.
const FILE_LINE_THRESHOLD = 300
const totalLines = computed(() => props.file.hunks.reduce((n, h) => n + h.lines.length, 0))
const collapsed = computed(() => !props.file.binary && isFileCollapsed(props.file.path, totalLines.value > FILE_LINE_THRESHOLD))

// Annotations targeting the whole File/Hunk/Binary have no single line to sit on —
// they're shown as a small bar below the header instead of being dropped silently.
const fileLevelAnnotations = computed(() => props.file.annotations.filter((a) => a.target.type !== 'line'))

// Line-level annotations can sit anywhere in a huge file, including behind a collapsed
// hunk's fold — surfaced at the file heading (with the hunk index needed to expand it)
// so a Reviewer doesn't have to scroll hunt-and-peck to find them.
interface LineAnnotationEntry {
  annotation: Annotation
  hunkIndex: number
  lineId: string
}
const lineLevelAnnotations = computed<LineAnnotationEntry[]>(() => {
  const entries: LineAnnotationEntry[] = []
  props.file.hunks.forEach((hunk, hunkIndex) => {
    for (const line of hunk.lines) {
      for (const annotation of line.annotations) entries.push({ annotation, hunkIndex, lineId: line.id })
    }
  })
  return entries
})

async function scrollToLine(hunkIndex: number, lineId: string) {
  expandHunk(props.file.path, hunkIndex)
  await nextTick()
  document.getElementById(lineAnchorId(lineId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const fileQuestions = computed(() => props.questions.filter((q) => q.target?.path === props.file.path))
const fileLevelQuestions = computed(() => fileQuestions.value.filter((q) => q.target?.type !== 'line'))

function questionsForLine(side: 'base' | 'head', line?: number): Question[] {
  if (line === undefined) return []
  return fileQuestions.value.filter((q) => q.target?.type === 'line' && q.target.side === side && q.target.line === line)
}

// Prefers the head side (matches what a Reviewer usually reasons about); falls back
// to base for pure-removal lines that have no head line number at all.
function lineTarget(text: string, oldLine?: number, newLine?: number) {
  return newLine !== undefined
    ? { type: 'line' as const, path: props.file.path, side: 'head' as const, line: newLine, expectedText: text }
    : { type: 'line' as const, path: props.file.path, side: 'base' as const, line: oldLine!, expectedText: text }
}

// A hunk with hundreds of lines mounts a DiffLineNote + QuestionThread component
// PER LINE — cheap for a handful of hunks, but a large MR can have thousands of
// lines across dozens of files, and most of a huge hunk is scrolled past unread.
// Cap what's mounted up front; expanding is a per-hunk opt-in, not a re-fetch.
const HUNK_LINE_THRESHOLD = 50

function visibleLines<T>(hi: number, lines: T[]): T[] {
  return isHunkExpanded(props.file.path, hi) || lines.length <= HUNK_LINE_THRESHOLD ? lines : lines.slice(0, HUNK_LINE_THRESHOLD)
}

function hiddenCount(hi: number, lines: unknown[]): number {
  return isHunkExpanded(props.file.path, hi) ? 0 : Math.max(0, lines.length - HUNK_LINE_THRESHOLD)
}

// Computed once per hunk (not once per pane) — the side-by-side layout renders two
// panes from the same row pairing, and both need to agree on exactly which rows are
// visible for the truncation + "show more" count to make sense.
const sideBySideRowsByHunk = computed(() => props.file.hunks.map((h) => toSideBySideRows(h.lines)))

// Keeps the two side-by-side panes' horizontal scroll positions in lockstep. The
// `syncing` guard stops the second pane's own scroll event (fired by our own
// programmatic scrollLeft write below) from bouncing back and re-triggering the first.
const leftPane = useTemplateRef<HTMLElement>('leftPane')
const rightPane = useTemplateRef<HTMLElement>('rightPane')
let syncing = false

function syncScroll(from: HTMLElement | null, to: HTMLElement | null) {
  if (!from || !to || syncing) return
  syncing = true
  to.scrollLeft = from.scrollLeft
  syncing = false
}
</script>

<template>
  <article :id="anchorId(file.path)" class="mb-6 overflow-hidden rounded-lg border border-default">
    <header class="flex items-center gap-3 border-b border-default bg-elevated px-4 py-2">
      <span class="text-dimmed">◇</span>
      <strong class="truncate font-mono text-sm">{{ file.path }}</strong>
      <span class="ml-auto flex items-center gap-2">
        <UBadge v-if="file.binary" color="neutral" variant="subtle" size="sm">binary</UBadge>
        <template v-else>
          <UBadge color="success" variant="subtle" size="sm">+{{ additions }}</UBadge>
          <UBadge color="error" variant="subtle" size="sm">−{{ deletions }}</UBadge>
          <UButton
            :icon="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="collapsed ? 'Expand diff' : 'Collapse diff'"
            @click="toggleFile(file.path, collapsed)"
          />
        </template>
      </span>
    </header>

    <div v-if="collapsed" class="px-4 py-2 text-xs text-muted">
      Diff collapsed ({{ totalLines }} lines) — click Expand above to view.
    </div>

    <template v-else>
    <div v-if="fileLevelAnnotations.length" class="flex flex-wrap items-center gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
      <span>Notes on this file:</span>
      <AnnotationBadge
        v-for="a in fileLevelAnnotations"
        :key="a.id"
        :annotation="a"
        :number="annotationNumbers.get(a.id) ?? 0"
      />
    </div>

    <div v-if="lineLevelAnnotations.length" class="flex flex-wrap items-center gap-2 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
      <span>Agent comments in this file:</span>
      <button
        v-for="entry in lineLevelAnnotations"
        :key="entry.annotation.id"
        type="button"
        :title="entry.annotation.summary"
        class="grid h-[18px] w-[18px] place-items-center rounded-full border border-warning/60 bg-warning/15 text-[10px] font-bold text-warning transition hover:scale-110 hover:bg-warning hover:text-inverted"
        @click="scrollToLine(entry.hunkIndex, entry.lineId)"
      >
        {{ annotationNumbers.get(entry.annotation.id) ?? 0 }}
      </button>
    </div>

    <div class="group flex flex-wrap items-center gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
      <span>Questions on this file:</span>
      <QuestionThread
        :target="{ type: 'file', path: file.path }"
        :questions="fileLevelQuestions"
        :answers="answers"
      />
    </div>

    <PipelineEvidence
      v-for="evidence in file.pipelineEvidence"
      :key="evidence.id"
      :job-name="evidence.jobName"
      :status="evidence.status"
      :url="evidence.url"
      :log-excerpt="evidence.logExcerpt"
      :description="evidence.description"
    />

    <template v-if="file.binary">
      <div v-if="file.imageEvidence.length === 0" class="p-4 text-sm text-muted">
        Binary change — no image evidence attached to compare.
      </div>
      <ImageDiff
        v-for="evidence in file.imageEvidence"
        :key="evidence.id"
        :asset-path="evidence.assetPath"
        :base-asset-path="evidence.baseAssetPath"
        :comparison-modes="evidence.comparisonModes"
        :description="evidence.description"
      />
    </template>

    <!--
      display:table (not grid/flex) so the browser computes ONE consistent row width and
      column set across every line in the hunk — with grid/flex, each row sizes to its own
      content independently, so short lines' backgrounds stop short and don't line up with
      long lines' gutters. The hunk header is a table-caption INSIDE the same table rather
      than a sibling div — a sibling's min-w-full only resolves against the pane's own
      width, not the wider scrollWidth the table itself establishes when a code line is
      longer than the pane; a caption always spans its table's actual computed width.
    -->
    <div v-else-if="layout === 'inline'" class="overflow-x-auto font-mono text-xs">
      <template v-for="(hunk, hi) in file.hunks" :key="hi">
      <div class="table w-max min-w-full border-collapse">
        <div class="table-caption caption-top whitespace-nowrap bg-elevated px-3 py-1 text-primary">
          @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} +{{ hunk.newStart }},{{ hunk.newLines }} @@
        </div>
        <div
          v-for="line in visibleLines(hi, hunk.lines)"
          :id="lineAnchorId(line.id)"
          :key="line.id"
          class="group table-row"
          :class="{
            'bg-success/10': line.kind === 'add',
            'bg-error/10': line.kind === 'remove',
          }"
        >
          <span class="table-cell select-none px-2 text-right align-baseline text-dimmed">{{ line.oldLine ?? '' }}</span>
          <span class="table-cell select-none px-2 text-right align-baseline text-dimmed">{{ line.newLine ?? '' }}</span>
          <span
            class="table-cell select-none text-center align-baseline"
            :class="{ 'text-success': line.kind === 'add', 'text-error': line.kind === 'remove' }"
          >
            {{ line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : '' }}
          </span>
          <span class="table-cell select-none px-1 align-baseline"
            ><QuestionThread
              :target="lineTarget(line.text, line.oldLine, line.newLine)"
              :questions="questionsForLine(line.newLine !== undefined ? 'head' : 'base', line.newLine ?? line.oldLine)"
              :answers="answers"
          /></span>
          <span class="table-cell whitespace-pre px-2 align-baseline text-[var(--syntax-text)]"
            ><code v-html="highlightCode(line.text)"></code
            ><DiffLineNote :annotations="line.annotations" :diagnostics="line.diagnostics" :numbers="annotationNumbers"
          /></span>
        </div>
      </div>
      <button
        v-if="hiddenCount(hi, hunk.lines)"
        type="button"
        class="w-full border-b border-default bg-elevated/50 px-3 py-1.5 text-left text-[10px] text-muted hover:text-default"
        @click="expandHunk(file.path, hi)"
      >
        ⋯ Show {{ hiddenCount(hi, hunk.lines) }} more lines
      </button>
      </template>
    </div>

    <div v-else class="font-mono text-xs">
      <div class="grid grid-cols-2 border-b border-default bg-elevated text-[10px] font-bold text-muted">
        <span class="px-3 py-1">Base · before</span>
        <span class="border-l border-default px-3 py-1">MR head · after</span>
      </div>
      <!--
        Each pane is its own independent horizontal scroller (min-w-0 lets a flex/grid
        child shrink below its content's natural width, which is what lets overflow-x-auto
        actually engage instead of the row silently pushing the pane wider than its
        50% share and spilling past the container).
      -->
      <div class="grid grid-cols-2">
        <div ref="leftPane" class="min-w-0 overflow-x-auto" @scroll="syncScroll(leftPane, rightPane)">
          <template v-for="(hunk, hi) in file.hunks" :key="hi">
          <div class="table w-max min-w-full border-collapse">
            <div class="table-caption caption-top whitespace-nowrap bg-elevated px-3 py-1 text-primary">
              @@ -{{ hunk.oldStart }},{{ hunk.oldLines }} @@
            </div>
            <div
              v-for="(row, ri) in visibleLines(hi, sideBySideRowsByHunk[hi])"
              :id="row.left && row.left !== row.right ? lineAnchorId(row.left.id) : undefined"
              :key="ri"
              class="group table-row"
              :class="{ 'bg-error/10': row.left?.kind === 'remove' }"
            >
              <span class="table-cell w-12 select-none px-2 text-right align-baseline text-dimmed">{{ row.left?.oldLine ?? '' }}</span>
              <span class="table-cell w-4 select-none text-center align-baseline text-error">{{ row.left?.kind === 'remove' ? '−' : '' }}</span>
              <span class="table-cell select-none px-1 align-baseline"
                ><QuestionThread
                  v-if="row.left"
                  :target="{ type: 'line', path: file.path, side: 'base', line: row.left.oldLine!, expectedText: row.left.text }"
                  :questions="questionsForLine('base', row.left.oldLine)"
                  :answers="answers"
              /></span>
              <span class="table-cell whitespace-pre px-2 align-baseline text-[var(--syntax-text)]"
                ><template v-if="row.left"
                  ><code v-html="highlightCode(row.left.text)"></code
                  ><DiffLineNote :annotations="row.left.annotations" :diagnostics="row.left.diagnostics" :numbers="annotationNumbers"
                /></template
              ></span>
            </div>
          </div>
          <button
            v-if="hiddenCount(hi, sideBySideRowsByHunk[hi])"
            type="button"
            class="w-full border-b border-default bg-elevated/50 px-3 py-1.5 text-left text-[10px] text-muted hover:text-default"
            @click="expandHunk(file.path, hi)"
          >
            ⋯ Show {{ hiddenCount(hi, sideBySideRowsByHunk[hi]) }} more rows
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
              v-for="(row, ri) in visibleLines(hi, sideBySideRowsByHunk[hi])"
              :id="row.right ? lineAnchorId(row.right.id) : undefined"
              :key="ri"
              class="group table-row"
              :class="{ 'bg-success/10': row.right?.kind === 'add' }"
            >
              <span class="table-cell w-12 select-none px-2 text-right align-baseline text-dimmed">{{ row.right?.newLine ?? '' }}</span>
              <span class="table-cell w-4 select-none text-center align-baseline text-success">{{ row.right?.kind === 'add' ? '+' : '' }}</span>
              <span class="table-cell select-none px-1 align-baseline"
                ><QuestionThread
                  v-if="row.right"
                  :target="{ type: 'line', path: file.path, side: 'head', line: row.right.newLine!, expectedText: row.right.text }"
                  :questions="questionsForLine('head', row.right.newLine)"
                  :answers="answers"
              /></span>
              <span class="table-cell whitespace-pre px-2 align-baseline text-[var(--syntax-text)]"
                ><template v-if="row.right"
                  ><code v-html="highlightCode(row.right.text)"></code
                  ><DiffLineNote :annotations="row.right.annotations" :diagnostics="row.right.diagnostics" :numbers="annotationNumbers"
                /></template
              ></span>
            </div>
          </div>
          <button
            v-if="hiddenCount(hi, sideBySideRowsByHunk[hi])"
            type="button"
            class="w-full border-b border-default bg-elevated/50 px-3 py-1.5 text-left text-[10px] text-muted hover:text-default"
            @click="expandHunk(file.path, hi)"
          >
            ⋯ Show {{ hiddenCount(hi, sideBySideRowsByHunk[hi]) }} more rows
          </button>
          </template>
        </div>
      </div>
    </div>
    </template>
  </article>
</template>
