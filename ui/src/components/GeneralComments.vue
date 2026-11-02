<script setup lang="ts">
import { computed } from 'vue'
import type { Answer } from '../types.ts'
import { useQuestionsStore } from '../composables/questions-store.ts'
import { watcherRead } from '../composables/bundle-status-store.ts'
import { openThread } from '../composables/question-panel-store.ts'
import { generalComments, visibleQuestions } from '../question-entries.ts'
import { threadState, threadStateBadge } from '../question-panel.ts'
import { commentKindColor, commentKindLabel, commentStatusColor, commentStatusLabel } from '../comment-style.ts'

const props = defineProps<{ answers: readonly Answer[] }>()

const store = useQuestionsStore()
const rows = computed(() =>
  generalComments(visibleQuestions(store.questions)).map((comment) => {
    const state = threadState(comment, props.answers.some((a) => a.questionId === comment.id), watcherRead.value)
    return { comment, badge: state ? threadStateBadge(state) : null }
  }),
)
</script>

<template>
  <div v-if="rows.length" data-testid="general-comments" class="mt-3 border-t border-default pt-3">
    <h3 class="mb-2 text-sm font-semibold">Your comments on the whole change</h3>
    <ul class="space-y-2">
      <li v-for="{ comment, badge } in rows" :key="comment.id" data-testid="general-comment">
        <button type="button" class="flex w-full items-start gap-2 text-left" @click="openThread(comment)">
          <UBadge size="sm" variant="subtle" :color="commentKindColor(comment)" class="shrink-0">{{ commentKindLabel(comment) }}</UBadge>
          <UBadge v-if="badge" size="sm" variant="subtle" :color="badge.color" :icon="badge.icon" class="shrink-0">
            {{ badge.label }}
          </UBadge>
          <UBadge v-else size="sm" variant="subtle" :color="commentStatusColor(comment)" class="shrink-0">
            {{ commentStatusLabel(comment) }}
          </UBadge>
          <span class="min-w-0 break-words">{{ comment.body }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
