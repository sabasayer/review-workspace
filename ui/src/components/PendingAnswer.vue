<script setup lang="ts">
import type { Question } from '../types.ts'
import { isLiveAnswering } from '../bundle-status.ts'
import { generatorPrompt, watcherRead } from '../composables/bundle-status-store.ts'
import { useCopyFeedback } from '../composables/useCopyFeedback.ts'
import { answerQuestionPrompt } from '../prompts.ts'

defineProps<{ question: Pick<Question, 'body' | 'target'> }>()

const { copied, copy } = useCopyFeedback()
</script>

<template>
  <p v-if="isLiveAnswering(watcherRead)" class="italic text-muted">Not answered yet.</p>
  <div v-else data-testid="waiting-for-agent" class="flex items-center gap-2">
    <span class="italic text-muted">Waiting for the agent.</span>
    <UButton size="xs" variant="soft" @click="copy(answerQuestionPrompt(generatorPrompt, question))">
      {{ copied ? 'Copied!' : 'Send to agent' }}
    </UButton>
  </div>
</template>
