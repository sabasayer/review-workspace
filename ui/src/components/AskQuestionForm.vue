<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Annotation, CommentKind, Target } from '../types.ts'
import { useQuestionThread } from '../composables/useQuestionThread.ts'

const props = defineProps<{ target?: Target; annotation?: Annotation }>()

const asking = ref(false)
const { draft, draftKind, busy, localError, submitNewQuestion, store } = useQuestionThread(() => props.target)
const hasToken = computed(() => store.writeToken.length > 0)

const kindOptions: Array<{ value: CommentKind; label: string }> = [
  { value: 'question', label: 'Question' },
  { value: 'change-request', label: 'Change request' },
]

function closeAsk() {
  asking.value = false
}

// Lets a Reviewer turn an agent-authored note straight into a change-request
// instead of retyping its summary — common for risk notes that are already
// phrased as "the author should do X".
function flagAsChangeRequest() {
  draftKind.value = 'change-request'
  draft.value = props.annotation?.summary ?? ''
  asking.value = true
}
</script>

<template>
  <div>
    <span v-if="!asking" class="flex flex-wrap gap-2">
      <UButton size="xs" variant="ghost" @click="asking = true">Ask a question</UButton>
      <UButton v-if="annotation" size="xs" variant="ghost" color="error" @click="flagAsChangeRequest">
        Flag as change-request
      </UButton>
    </span>
    <template v-else>
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
      <UTextarea
        v-model="draft"
        size="sm"
        class="w-full"
        :rows="2"
        :placeholder="draftKind === 'change-request' ? 'What needs to change?' : `What's the reasoning here?`"
      />
      <p v-if="localError" class="mt-1 text-error">{{ localError }}</p>
      <p v-if="!hasToken" class="mt-1 text-warning">Set your write token first (top right).</p>
      <div class="mt-1 flex gap-2">
        <UButton size="xs" :disabled="busy || !hasToken" @click="submitNewQuestion(closeAsk)">
          {{ draftKind === 'change-request' ? 'Raise change request' : 'Ask' }}
        </UButton>
        <UButton size="xs" variant="ghost" @click="closeAsk">Cancel</UButton>
      </div>
    </template>
  </div>
</template>
