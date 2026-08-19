<script setup lang="ts">
import { computed, ref } from 'vue'
import AnnotationCard from '../components/AnnotationCard.vue'
import DiffFile from '../components/DiffFile.vue'
import FocusMode from '../components/FocusMode.vue'
import MrDetailsSlideover from '../components/MrDetailsSlideover.vue'
import QuestionsSlideover from '../components/QuestionsSlideover.vue'
import ReviewHeader from '../components/ReviewHeader.vue'
import Sidebar from '../components/Sidebar.vue'
import VerdictPanel from '../components/VerdictPanel.vue'
import { useCopyFeedback } from '../composables/useCopyFeedback.ts'
import { useReviewView } from '../composables/useReviewView.ts'
import { buildAnnotationNumbers } from '../annotation-numbers.ts'
import { collectVerificationEntries, groupRiskLookup, startHere } from '../annotation-view.ts'
import { formatHeaderTitle, hasMrMetadata, renderComparisonDescription } from '../comparison-header.ts'
import { anchorId } from '../diff-layout.ts'
import { groupFilesByBehavioralGroup } from '../grouped-files.ts'
import {
  countOpenQuestions,
  resolveQuestionEntries,
  scrollToQuestionTarget,
} from '../question-entries.ts'
import { setWriteToken, useQuestionsStore } from '../composables/questions-store.ts'

const { viewModel, error } = useReviewView()
const questionsStore = useQuestionsStore()
const { copied: promptCopied, copy } = useCopyFeedback()

const layout = ref<'inline' | 'side-by-side'>('inline')
const navVisible = ref(true)
const mrInfoOpen = ref(false)
const questionsOpen = ref(false)
const focusMode = ref(false)
// Owned here, not inside FocusMode — it must survive toggling focus mode off
// (e.g. "view diff for this item") and back on, which unmounts/remounts FocusMode.
const focusEntryId = ref<string | undefined>()
const writeTokenDraft = ref(questionsStore.writeToken)

const groupedFiles = computed(() => {
  const vm = viewModel.value
  if (!vm) return []
  return groupFilesByBehavioralGroup(vm.files, vm.groups)
})

const focusModeCount = computed(() => {
  const vm = viewModel.value
  if (!vm) return 0
  return startHere(collectVerificationEntries(vm.files), groupRiskLookup(vm.groups)).length
})

function exitFocusMode(path: string | null) {
  focusMode.value = false
  if (path) {
    requestAnimationFrame(() => document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

const annotationNumbers = computed(() => buildAnnotationNumbers(groupedFiles.value))

const comparison = computed(() => viewModel.value?.comparison ?? null)
const headerTitle = computed(() => formatHeaderTitle(comparison.value ?? undefined))
const mrMetadata = computed(() => hasMrMetadata(comparison.value ?? undefined))
const descriptionHtml = computed(() => renderComparisonDescription(comparison.value ?? undefined))

const questionEntries = computed(() => {
  const vm = viewModel.value
  if (!vm) return []
  return resolveQuestionEntries(vm.files, vm.answers, questionsStore.questions)
})

const openQuestionCount = computed(() => countOpenQuestions(questionEntries.value))

function saveWriteToken(close: () => void) {
  setWriteToken(writeTokenDraft.value.trim())
  close()
}

async function copyPrompt() {
  if (!viewModel.value) return
  await copy(viewModel.value.generatorPrompt)
}

async function onQuestionSelect(entry: (typeof questionEntries.value)[number]) {
  questionsOpen.value = false
  await scrollToQuestionTarget(entry)
}
</script>

<template>
  <div class="flex h-screen flex-col bg-default text-default">
    <ReviewHeader
      :header-title="headerTitle"
      :comparison="comparison"
      :has-mr-metadata="mrMetadata"
      :nav-visible="navVisible"
      :layout="layout"
      :open-question-count="openQuestionCount"
      :prompt-copied="promptCopied"
      :has-write-token="questionsStore.writeToken.length > 0"
      :write-token-draft="writeTokenDraft"
      :focus-mode="focusMode"
      :focus-mode-count="focusModeCount"
      @update:nav-visible="navVisible = $event"
      @update:layout="layout = $event"
      @update:write-token-draft="writeTokenDraft = $event"
      @update:focus-mode="focusMode = $event"
      @open-questions="questionsOpen = true"
      @open-mr-details="mrInfoOpen = true"
      @copy-prompt="copyPrompt"
      @save-write-token="saveWriteToken"
    />

    <MrDetailsSlideover
      v-if="comparison"
      v-model:open="mrInfoOpen"
      :comparison="comparison"
      :description-html="descriptionHtml"
    />

    <QuestionsSlideover
      v-model:open="questionsOpen"
      :entries="questionEntries"
      :current-round="viewModel?.round ?? 1"
      @select="onQuestionSelect"
    />

    <div v-if="error" class="p-4 text-error">Failed to load bundle: {{ error }}</div>
    <div v-else-if="!viewModel" class="p-4 text-muted">Loading…</div>

    <FocusMode
      v-else-if="focusMode"
      :files="viewModel.files"
      :groups="viewModel.groups"
      :current-id="focusEntryId"
      @update:current-id="focusEntryId = $event"
      @exit="exitFocusMode"
    />

    <div v-else class="flex flex-1 overflow-hidden">
      <aside v-if="navVisible" class="w-64 shrink-0 overflow-y-auto border-r border-default p-3">
        <Sidebar :groups="groupedFiles" :files="viewModel.files" />
      </aside>
      <main class="flex-1 overflow-y-auto p-4">
        <div v-if="viewModel.diagnostics.length" class="mb-4 rounded border border-warning/50 bg-warning/10 p-3 text-xs">
          <strong>{{ viewModel.diagnostics.length }} bundle-level diagnostic(s)</strong>
        </div>
        <VerdictPanel v-if="viewModel.summary" :summary="viewModel.summary" :files="viewModel.files" :groups="viewModel.groups" />
        <section v-for="(bucket, i) in groupedFiles" :key="bucket.group?.id ?? `ungrouped-${i}`" class="mb-8">
          <div class="mb-3 flex items-center gap-2">
            <h2 v-if="bucket.group" class="text-base font-semibold">{{ bucket.group.title }}</h2>
            <h2 v-else class="text-base font-semibold text-muted">Other changes</h2>
            <UBadge v-if="bucket.group?.risk" :color="{ high: 'error', medium: 'warning', low: 'success' }[bucket.group.risk]" variant="subtle" size="sm">
              {{ bucket.group.risk }}
            </UBadge>
          </div>

          <div
            v-if="bucket.files.some((f) => f.annotations.length)"
            class="mb-4 flex flex-col gap-3"
          >
            <AnnotationCard
              v-for="annotation in bucket.files.flatMap((f) => f.annotations)"
              :key="annotation.id"
              :annotation="annotation"
            />
          </div>

          <DiffFile
            v-for="file in bucket.files"
            :key="file.path"
            :file="file"
            :layout="layout"
            :annotation-numbers="annotationNumbers"
            :questions="questionsStore.questions"
            :answers="viewModel.answers"
          />
        </section>
      </main>
    </div>
  </div>
</template>
