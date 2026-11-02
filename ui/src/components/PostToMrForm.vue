<script setup lang="ts">
import { ref } from 'vue'
import type { Target } from '../types.ts'
import { useCopyFeedback } from '../composables/useCopyFeedback.ts'
import { postToMrPrompt } from '../prompts.ts'

const props = defineProps<{ target?: Target; body: string }>()

const editing = ref(false)
const text = ref('')
const { copied, copy } = useCopyFeedback()

function start() {
  text.value = props.body
  editing.value = true
}
</script>

<template>
  <div>
    <UButton v-if="!editing" data-testid="post-to-mr" size="xs" variant="ghost" @click="start">Post to MR</UButton>
    <template v-else>
      <UTextarea v-model="text" data-testid="post-to-mr-text" size="sm" class="w-full" :rows="4" />
      <p class="mt-1 text-muted">Copy this prompt for the agent. The agent posts it after you say "send".</p>
      <div class="mt-1 flex gap-2">
        <UButton size="xs" :disabled="!text.trim()" @click="copy(postToMrPrompt(target, text))">
          {{ copied ? 'Copied!' : 'Copy prompt' }}
        </UButton>
        <UButton size="xs" variant="ghost" @click="editing = false">Cancel</UButton>
      </div>
    </template>
  </div>
</template>
