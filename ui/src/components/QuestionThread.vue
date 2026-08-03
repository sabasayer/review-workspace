<script setup lang="ts">
import { computed } from 'vue'
import type { Answer, Question, Target } from '../types.ts'
import { useQuestionThread } from '../composables/useQuestionThread.ts'

const props = defineProps<{ target?: Target; questions: readonly Question[]; answers: readonly Answer[] }>()

const {
  store,
  draft,
  busy,
  localError,
  editingId,
  editDraft,
  submitNewQuestion,
  startEdit,
  submitEdit,
} = useQuestionThread(() => props.target)

const hasToken = computed(() => store.writeToken.length > 0)

function answerFor(questionId: string): Answer | undefined {
  return props.answers.find((a) => a.questionId === questionId)
}
</script>

<template>
  <span class="inline-flex items-center gap-1 align-middle">
    <UPopover v-for="q in questions" :key="q.id">
      <button
        type="button"
        class="grid h-[18px] w-[18px] place-items-center rounded-full border text-[10px] font-bold transition hover:scale-110"
        :class="
          q.status === 'withdrawn'
            ? 'border-dimmed/60 bg-dimmed/10 text-dimmed line-through'
            : 'border-info/60 bg-info/15 text-info hover:bg-info hover:text-inverted'
        "
        :aria-label="`Question: ${q.body}`"
      >
        ?
      </button>
      <template #content="{ close }">
        <div class="w-80 p-3 text-xs">
          <p class="mb-1 flex items-center gap-2">
            <UBadge size="sm" variant="subtle" :color="q.status === 'open' ? 'info' : 'neutral'">{{ q.status }}</UBadge>
          </p>
          <p class="mb-2 leading-relaxed">{{ q.body }}</p>
          <template v-if="answerFor(q.id)">
            <p class="mb-1 text-[10px] font-bold text-muted">Answer</p>
            <p class="mb-2 leading-relaxed text-muted">{{ answerFor(q.id)!.body }}</p>
          </template>
          <p v-else-if="q.status === 'open'" class="mb-2 text-muted italic">Not answered yet.</p>

          <template v-if="q.status === 'open'">
            <UButton v-if="editingId !== q.id" size="xs" variant="ghost" @click="startEdit(q.id)">Withdraw &amp; rephrase</UButton>
            <template v-else>
              <UTextarea v-model="editDraft" size="sm" class="mt-1 w-full" :rows="2" placeholder="Better phrased question…" />
              <div class="mt-1 flex gap-2">
                <UButton size="xs" :disabled="busy || !hasToken" @click="submitEdit(q.id, close)">Submit</UButton>
                <UButton size="xs" variant="ghost" @click="editingId = null">Cancel</UButton>
              </div>
              <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
            </template>
          </template>
        </div>
      </template>
    </UPopover>

    <UPopover>
      <button
        type="button"
        class="grid h-[18px] w-[18px] place-items-center rounded-full border border-dimmed/40 text-[10px] text-dimmed opacity-0 transition group-hover:opacity-100 hover:scale-110 hover:border-info hover:text-info"
        aria-label="Ask a question about this"
      >
        +
      </button>
      <template #content="{ close }">
        <div class="w-80 p-3 text-xs">
          <p class="mb-2 text-muted">Ask a question anchored to this exact line.</p>
          <UTextarea v-model="draft" size="sm" class="w-full" :rows="2" placeholder="What's the reasoning here?" />
          <p v-if="localError" class="mt-1 text-error">{{ localError }}</p>
          <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
          <UButton size="xs" class="mt-2" :disabled="busy || !hasToken" @click="submitNewQuestion(close)">Ask</UButton>
        </div>
      </template>
    </UPopover>
  </span>
</template>
