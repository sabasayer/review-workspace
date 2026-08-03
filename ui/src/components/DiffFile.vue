<script setup lang="ts">
import { computed } from 'vue'
import type { Answer, Question, RenderedFile } from '../types.ts'
import { anchorId } from '../diff-layout.ts'
import { isFileCollapsed, toggleFile } from '../composables/expanded-files-store.ts'
import { countAdditions, countDeletions, shouldCollapseLargeFile, totalHunkLines } from '../diff-file-stats.ts'
import { fileLevelAnnotations, lineLevelAnnotations } from '../file-annotations.ts'
import { fileLevelQuestions, scrollToLineInFile } from '../question-entries.ts'
import AnnotationBadge from './AnnotationBadge.vue'
import DiffInlineLayout from './DiffInlineLayout.vue'
import DiffSideBySideLayout from './DiffSideBySideLayout.vue'
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

const additions = computed(() => countAdditions(props.file))
const deletions = computed(() => countDeletions(props.file))
const totalLines = computed(() => totalHunkLines(props.file))
const collapsed = computed(() => isFileCollapsed(props.file.path, shouldCollapseLargeFile(props.file)))
const annotationsAtFileLevel = computed(() => fileLevelAnnotations(props.file))
const annotationsAtLineLevel = computed(() => lineLevelAnnotations(props.file))
const questionsAtFileLevel = computed(() => fileLevelQuestions(props.questions, props.file.path))
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
      <div v-if="annotationsAtFileLevel.length" class="flex flex-wrap items-center gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
        <span>Notes on this file:</span>
        <AnnotationBadge
          v-for="a in annotationsAtFileLevel"
          :key="a.id"
          :annotation="a"
          :number="annotationNumbers.get(a.id) ?? 0"
        />
      </div>

      <div v-if="annotationsAtLineLevel.length" class="flex flex-wrap items-center gap-2 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
        <span>Agent comments in this file:</span>
        <button
          v-for="entry in annotationsAtLineLevel"
          :key="entry.annotation.id"
          type="button"
          :title="entry.annotation.summary"
          class="grid h-[18px] w-[18px] place-items-center rounded-full border border-warning/60 bg-warning/15 text-[10px] font-bold text-warning transition hover:scale-110 hover:bg-warning hover:text-inverted"
          @click="scrollToLineInFile(file.path, entry.hunkIndex, entry.lineId)"
        >
          {{ annotationNumbers.get(entry.annotation.id) ?? 0 }}
        </button>
      </div>

      <div class="group flex flex-wrap items-center gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
        <span>Questions on this file:</span>
        <QuestionThread :target="{ type: 'file', path: file.path }" :questions="questionsAtFileLevel" :answers="answers" />
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

      <DiffInlineLayout
        v-else-if="layout === 'inline'"
        :file="file"
        :annotation-numbers="annotationNumbers"
        :questions="questions"
        :answers="answers"
      />
      <DiffSideBySideLayout
        v-else
        :file="file"
        :annotation-numbers="annotationNumbers"
        :questions="questions"
        :answers="answers"
      />
    </template>
  </article>
</template>
