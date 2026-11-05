<script setup lang="ts">
import { computed } from 'vue'
import type { QuestionEntry } from '../question-entries.ts'
import { renderMarkdown } from '../markdown.ts'
import { isLiveAnswering } from '../bundle-status.ts'
import { watcherRead } from '../composables/bundle-status-store.ts'
import { useCollapsedComments } from '../composables/useCollapsedComments.ts'
import { useQuestionThread } from '../composables/useQuestionThread.ts'
import { threadState, threadStateBadge, threadTargetLabel } from '../question-panel.ts'
import {
  commentKindColor,
  commentKindLabel,
  commentStatusColor,
  commentStatusLabel,
  resolutionStatusColor,
  resolutionStatusLabel,
} from '../comment-style.ts'
import PendingAnswer from './PendingAnswer.vue'
import PostToMrForm from './PostToMrForm.vue'

const props = defineProps<{ entry: QuestionEntry; currentRound: number; active: boolean }>()
const emit = defineEmits<{ open: []; showInCode: [] }>()

const comment = computed(() => props.entry.question)
const state = computed(() => threadState(comment.value, !!props.entry.answer, watcherRead.value))
const stateBadge = computed(() => (state.value ? threadStateBadge(state.value) : null))
const showSendToAgent = computed(() => state.value === 'waiting' && !isLiveAnswering(watcherRead.value))

const { store, busy, localError, editingId, editDraft, startEdit, submitEdit, remove, resolve } = useQuestionThread(
  () => comment.value.target,
)
const hasToken = computed(() => store.writeToken.length > 0)
const { isCollapsed, toggleExpanded } = useCollapsedComments()
</script>

<template>
  <article
    :id="`thread-${comment.id}`"
    data-testid="question-thread"
    :data-state="state ?? 'none'"
    class="rounded-lg border p-3 text-sm"
    :class="active ? 'border-primary ring-1 ring-primary' : 'border-default'"
    @click="emit('open')"
  >
    <div class="mb-1 flex flex-wrap items-center gap-2">
      <UBadge size="sm" variant="subtle" :color="commentKindColor(comment)">{{ commentKindLabel(comment) }}</UBadge>
      <UBadge
        v-if="stateBadge"
        data-testid="thread-state"
        size="md"
        variant="subtle"
        :color="stateBadge.color"
        :icon="stateBadge.icon"
        :ui="{ leadingIcon: state === 'answering' ? 'animate-spin motion-reduce:animate-none' : '' }"
      >
        {{ stateBadge.label }}
      </UBadge>
      <UBadge v-else size="sm" variant="subtle" :color="commentStatusColor(comment)">{{ commentStatusLabel(comment) }}</UBadge>
      <UBadge
        v-if="comment.resolution"
        size="sm"
        variant="subtle"
        :color="resolutionStatusColor(comment.resolution.status)"
        :title="comment.resolution.evidence"
      >
        {{ resolutionStatusLabel(comment.resolution.status) }}
      </UBadge>
      <UBadge v-if="comment.originRound !== currentRound" size="sm" variant="outline" color="neutral">
        Round {{ comment.originRound }}
      </UBadge>
      <UButton v-if="comment.resolved" size="xs" variant="ghost" class="ml-auto" @click.stop="toggleExpanded(comment.id)">
        {{ isCollapsed(comment) ? 'Show' : 'Hide' }}
      </UButton>
    </div>

    <p class="mb-1 flex items-center gap-2 text-xs text-muted">
      <span data-testid="thread-target" class="min-w-0 truncate font-mono">{{ threadTargetLabel(comment.target) }}</span>
      <UButton v-if="entry.filePath" size="xs" variant="ghost" class="shrink-0" @click.stop="emit('showInCode')">
        Show in code
      </UButton>
    </p>

    <template v-if="!isCollapsed(comment)">
      <p class="break-words leading-relaxed" :class="{ 'text-muted line-through': comment.status === 'withdrawn' }">
        {{ comment.body }}
      </p>
      <p v-if="comment.resolution" class="mt-1 text-muted">{{ comment.resolution.evidence }}</p>
      <p v-if="comment.kind === 'change-request' && comment.resolved" class="mt-1 text-muted italic">
        Marked fixed {{ new Date(comment.resolvedAt!).toLocaleString() }}
      </p>

      <div v-if="entry.answer" class="mt-2 border-t border-default pt-2 text-muted">
        <p class="mb-0.5 text-xs font-bold">Answer</p>
        <div class="markdown-body break-words leading-relaxed" v-html="renderMarkdown(entry.answer.body)" />
      </div>
      <PendingAnswer v-else-if="showSendToAgent" class="mt-2" :question="comment" />

      <PostToMrForm class="mt-2" :target="comment.target" :body="comment.body" />

      <div class="mt-2">
        <template v-if="comment.status === 'open' && comment.kind === 'change-request' && !comment.resolved">
          <UButton size="xs" :disabled="busy || !hasToken" @click.stop="resolve(comment.id)">Mark as fixed</UButton>
          <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
        </template>

        <template v-else-if="comment.status === 'open' && comment.kind === 'question'">
          <span v-if="editingId !== comment.id" class="flex gap-2">
            <UButton size="xs" variant="ghost" @click.stop="startEdit(comment.id)">Withdraw &amp; rephrase</UButton>
            <UButton size="xs" variant="ghost" color="error" :disabled="busy || !hasToken" @click.stop="remove(comment.id)">
              Delete
            </UButton>
          </span>
          <template v-else>
            <UTextarea v-model="editDraft" size="sm" class="mt-1 w-full" :rows="2" placeholder="Better phrased question…" />
            <div class="mt-1 flex gap-2">
              <UButton size="xs" :disabled="busy || !hasToken" @click.stop="submitEdit(comment.id, () => {})">Submit</UButton>
              <UButton size="xs" variant="ghost" @click.stop="editingId = null">Cancel</UButton>
            </div>
            <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
          </template>
        </template>
        <p v-if="localError" class="mt-1 text-error">{{ localError }}</p>
      </div>
    </template>
    <p v-else class="truncate text-muted italic">{{ comment.body }}</p>
  </article>
</template>
