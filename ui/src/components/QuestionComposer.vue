<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { CommentKind } from '../types.ts'
import { draftRows } from '../change-request-draft.ts'
import { panelState, selectComposerTarget, setComposerKind } from '../composables/question-panel-store.ts'
import { useQuestionThread } from '../composables/useQuestionThread.ts'
import { composerChoices, targetKey } from '../question-panel.ts'

const { store, draft, draftKind, busy, localError, submitNewQuestion } = useQuestionThread(() => panelState.composerTarget, {
  draft: toRef(panelState, 'draft'),
  kind: toRef(panelState, 'kind'),
})

const hasToken = computed(() => store.writeToken.length > 0)
const choices = computed(() => composerChoices(panelState.anchorTarget))
const selectedKey = computed({
  get: () => targetKey(panelState.composerTarget),
  set: (key: string) => {
    const choice = choices.value.find((c) => c.key === key)
    if (choice) selectComposerTarget(choice.target)
  },
})

const kindOptions: Array<{ value: CommentKind; label: string }> = [
  { value: 'question', label: 'Question' },
  { value: 'change-request', label: 'Change request' },
]
</script>

<template>
  <form data-testid="question-composer" class="space-y-2 p-3 text-xs" @submit.prevent="submitNewQuestion(() => {})">
    <div class="flex items-center gap-2">
      <label for="composer-target" class="shrink-0 font-semibold">About</label>
      <select
        id="composer-target"
        v-model="selectedKey"
        data-testid="composer-target"
        class="min-w-0 flex-1 truncate rounded border border-control bg-default px-2 py-1 font-mono"
      >
        <option v-for="choice in choices" :key="choice.key" :value="choice.key">{{ choice.label }}</option>
      </select>
    </div>
    <UFieldGroup size="xs">
      <UButton
        v-for="option in kindOptions"
        :key="option.value"
        :variant="draftKind === option.value ? 'solid' : 'outline'"
        :color="option.value === 'change-request' ? 'error' : 'neutral'"
        @click="setComposerKind(option.value)"
      >
        {{ option.label }}
      </UButton>
    </UFieldGroup>
    <UTextarea
      v-model="draft"
      size="sm"
      class="w-full"
      :rows="draftRows(draftKind)"
      :placeholder="draftKind === 'change-request' ? 'What needs to change?' : `What's the reasoning here?`"
    />
    <p v-if="localError" class="text-error">{{ localError }}</p>
    <p v-if="!hasToken" class="text-warning">Set your write token first (top right).</p>
    <UButton type="submit" size="xs" :disabled="busy || !hasToken">
      {{ draftKind === 'change-request' ? 'Raise change request' : 'Ask' }}
    </UButton>
  </form>
</template>
