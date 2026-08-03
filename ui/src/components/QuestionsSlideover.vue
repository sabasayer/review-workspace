<script setup lang="ts">
import type { QuestionEntry } from '../question-entries.ts'

defineProps<{ entries: QuestionEntry[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [entry: QuestionEntry] }>()
</script>

<template>
  <USlideover v-model:open="open" title="Questions" side="right">
    <template #body>
      <p v-if="!entries.length" class="text-sm text-muted">No Questions raised on this bundle yet.</p>
      <ul class="space-y-3">
        <li v-for="entry in entries" :key="entry.question.id" class="rounded-lg border border-default p-3 text-sm">
          <button
            type="button"
            class="block w-full text-left"
            :disabled="!entry.filePath"
            @click="emit('select', entry)"
          >
            <div class="mb-1 flex items-center gap-2">
              <UBadge
                size="sm"
                variant="subtle"
                :color="entry.answer ? 'success' : entry.question.status === 'open' ? 'warning' : 'neutral'"
              >
                {{ entry.answer ? 'Answered' : entry.question.status === 'open' ? 'Open' : 'Withdrawn' }}
              </UBadge>
              <span v-if="entry.filePath" class="truncate font-mono text-xs text-muted">{{ entry.filePath }}</span>
            </div>
            <p class="leading-relaxed" :class="{ 'text-muted line-through': entry.question.status === 'withdrawn' }">
              {{ entry.question.body }}
            </p>
            <div v-if="entry.answer" class="mt-2 border-t border-default pt-2 text-muted">
              <p class="mb-0.5 text-[10px] font-bold">Answer</p>
              <p class="leading-relaxed whitespace-pre-wrap">{{ entry.answer.body }}</p>
            </div>
          </button>
        </li>
      </ul>
    </template>
  </USlideover>
</template>
