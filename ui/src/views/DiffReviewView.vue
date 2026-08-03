<script setup lang="ts">
import { computed, ref } from 'vue'
import DiffFile from '../components/DiffFile.vue'
import FileNav from '../components/FileNav.vue'
import MrDetailsSlideover from '../components/MrDetailsSlideover.vue'
import QuestionsSlideover from '../components/QuestionsSlideover.vue'
import ReviewHeader from '../components/ReviewHeader.vue'
import { useCopyFeedback } from '../composables/useCopyFeedback.ts'
import { useReviewView } from '../composables/useReviewView.ts'
import { buildAnnotationNumbers } from '../annotation-numbers.ts'
import { formatHeaderTitle, hasMrMetadata, renderComparisonDescription } from '../comparison-header.ts'
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
const writeTokenDraft = ref(questionsStore.writeToken)

const groupedFiles = computed(() => {
  const vm = viewModel.value
  if (!vm) return []
  return groupFilesByBehavioralGroup(vm.files, vm.groups)
})

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
      @update:nav-visible="navVisible = $event"
      @update:layout="layout = $event"
      @update:write-token-draft="writeTokenDraft = $event"
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

    <QuestionsSlideover v-model:open="questionsOpen" :entries="questionEntries" @select="onQuestionSelect" />

    <div v-if="error" class="p-4 text-error">Failed to load bundle: {{ error }}</div>
    <div v-else-if="!viewModel" class="p-4 text-muted">Loading…</div>

    <div v-else class="flex flex-1 overflow-hidden">
      <aside v-if="navVisible" class="w-64 shrink-0 overflow-y-auto border-r border-default p-3">
        <FileNav :groups="groupedFiles" />
      </aside>
      <main class="flex-1 overflow-y-auto p-4">
        <div v-if="viewModel.diagnostics.length" class="mb-4 rounded border border-warning/50 bg-warning/10 p-3 text-xs">
          <strong>{{ viewModel.diagnostics.length }} bundle-level diagnostic(s)</strong>
        </div>
        <section v-for="(bucket, i) in groupedFiles" :key="bucket.group?.id ?? `ungrouped-${i}`" class="mb-8">
          <h2 v-if="bucket.group" class="mb-2 text-base font-semibold">{{ bucket.group.title }}</h2>
          <h2 v-else class="mb-2 text-base font-semibold text-muted">Other changes</h2>
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
