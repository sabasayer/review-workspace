<script setup lang="ts">
import { computed } from 'vue'
import type { Answer, CommentKind, Question, Target } from '../types.ts'
import { useQuestionThread } from '../composables/useQuestionThread.ts'
import { commentBadgeClasses, commentGlyph } from '../comment-style.ts'

const props = defineProps<{ target?: Target; questions: readonly Question[]; answers: readonly Answer[] }>()

const {
  store,
  draft,
  draftKind,
  busy,
  localError,
  editingId,
  editDraft,
  submitNewQuestion,
  startEdit,
  submitEdit,
  resolve,
} = useQuestionThread(() => props.target)

const hasToken = computed(() => store.writeToken.length > 0)

function answerFor(questionId: string): Answer | undefined {
  return props.answers.find((a) => a.questionId === questionId)
}

const kindOptions: Array<{ value: CommentKind; label: string }> = [
  { value: 'question', label: 'Question' },
  { value: 'change-request', label: 'Change request' },
]
</script>

<template>
  <span class="inline-flex items-center gap-1 align-middle">
    <UPopover v-for="q in questions" :key="q.id">
      <button
        type="button"
        class="grid h-[18px] w-[18px] place-items-center rounded-full border text-[10px] font-bold transition hover:scale-110"
        :class="commentBadgeClasses(q)"
        :aria-label="`${q.kind === 'change-request' ? 'Change request' : 'Question'}${q.resolved ? ' (resolved)' : ''}: ${q.body}`"
      >
        {{ commentGlyph(q) }}
      </button>
      <template #content="{ close }">
        <div class="w-80 p-3 text-xs">
          <p class="mb-1 flex items-center gap-2">
            <UBadge size="sm" variant="subtle" :color="q.kind === 'change-request' ? 'error' : 'info'">
              {{ q.kind === 'change-request' ? 'Change request' : 'Question' }}
            </UBadge>
            <UBadge
              size="sm"
              variant="subtle"
              :color="q.resolved ? 'success' : q.status === 'open' ? 'warning' : 'neutral'"
            >
              {{ q.resolved ? 'Resolved' : q.status === 'open' ? 'Open' : 'Withdrawn' }}
            </UBadge>
          </p>
          <p class="mb-2 leading-relaxed">{{ q.body }}</p>
          <template v-if="q.kind === 'question'">
            <p v-if="answerFor(q.id)" class="mb-1 text-[10px] font-bold text-muted">Answer</p>
            <p v-if="answerFor(q.id)" class="mb-2 leading-relaxed text-muted">{{ answerFor(q.id)!.body }}</p>
            <p v-else-if="q.status === 'open'" class="mb-2 text-muted italic">Not answered yet.</p>
          </template>
          <p v-else-if="q.resolved" class="mb-2 text-muted italic">Resolved {{ new Date(q.resolvedAt!).toLocaleString() }}</p>

          <template v-if="q.status === 'open' && q.kind === 'change-request' && !q.resolved">
            <UButton size="xs" :disabled="busy || !hasToken" @click="resolve(q.id)">Mark resolved</UButton>
            <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
          </template>

          <template v-else-if="q.status === 'open' && q.kind === 'question'">
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
        aria-label="Comment on this"
      >
        +
      </button>
      <template #content="{ close }">
        <div class="w-80 p-3 text-xs">
          <UFieldGroup size="xs" class="mb-2">
            <UButton
              v-for="option in kindOptions"
              :key="option.value"
              :variant="draftKind === option.value ? 'solid' : 'outline'"
              :color="option.value === 'change-request' ? 'error' : 'neutral'"
              @click="draftKind = option.value"
            >
              {{ option.label }}
            </UButton>
          </UFieldGroup>
          <p class="mb-2 text-muted">
            {{ draftKind === 'change-request' ? 'Ask for a change on this exact line.' : "Ask a question about this exact line." }}
          </p>
          <UTextarea
            v-model="draft"
            size="sm"
            class="w-full"
            :rows="2"
            :placeholder="draftKind === 'change-request' ? 'What needs to change?' : `What's the reasoning here?`"
          />
          <p v-if="localError" class="mt-1 text-error">{{ localError }}</p>
          <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
          <UButton size="xs" class="mt-2" :disabled="busy || !hasToken" @click="submitNewQuestion(close)">
            {{ draftKind === 'change-request' ? 'Raise change request' : 'Ask' }}
          </UButton>
        </div>
      </template>
    </UPopover>
  </span>
</template>
