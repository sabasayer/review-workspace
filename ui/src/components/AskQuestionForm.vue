<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Annotation, GeneralAnnotation, Target } from '../types.ts'
import { useQuestionThread } from '../composables/useQuestionThread.ts'
import { openComposer } from '../composables/question-panel-store.ts'
import { splitHeadline } from '../annotation-view.ts'
import { changeRequestDraft, draftRows, questionDraft } from '../change-request-draft.ts'

const props = defineProps<{ target: Target; annotation?: Annotation | GeneralAnnotation }>()

const raising = ref(false)
const { draft, draftKind, busy, localError, submitNewQuestion, store } = useQuestionThread(() => props.target)
const hasToken = computed(() => store.writeToken.length > 0)

function closeRaise() {
  raising.value = false
}

function askInPanel() {
  const headline = props.annotation && splitHeadline(props.annotation.summary).headline
  openComposer({ target: props.target, draft: questionDraft(props.target, headline) })
}

function raiseAsChangeRequest() {
  draftKind.value = 'change-request'
  draft.value = props.annotation ? changeRequestDraft(props.annotation) : ''
  raising.value = true
}
</script>

<template>
  <div>
    <span v-if="!raising" class="flex flex-wrap gap-2">
      <UButton size="xs" variant="outline" color="neutral" @click="askInPanel">Ask a question</UButton>
      <UButton v-if="annotation" size="xs" variant="outline" color="error" @click="raiseAsChangeRequest">
        Raise as change-request
      </UButton>
    </span>
    <template v-else>
      <UTextarea
        v-model="draft"
        size="sm"
        class="w-full"
        :rows="draftRows('change-request')"
        placeholder="What needs to change?"
      />
      <p v-if="localError" class="mt-1 text-error">{{ localError }}</p>
      <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
      <div class="mt-1 flex gap-2">
        <UButton size="xs" :disabled="busy || !hasToken" @click="submitNewQuestion(closeRaise)">Raise change request</UButton>
        <UButton size="xs" variant="ghost" @click="closeRaise">Cancel</UButton>
      </div>
    </template>
  </div>
</template>
