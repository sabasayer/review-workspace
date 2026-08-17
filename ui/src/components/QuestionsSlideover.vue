<script setup lang="ts">
import { ref } from 'vue'
import type { QuestionEntry } from '../question-entries.ts'

defineProps<{ entries: QuestionEntry[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [entry: QuestionEntry] }>()

// Resolved change-request Comments collapse by default (per the framework's
// "never disappear, but stay out of the way once handled" posture) — expanding
// one is purely local UI state, never anything persisted.
const expandedIds = ref(new Set<string>())

function isCollapsed(entry: QuestionEntry): boolean {
  return entry.question.resolved && !expandedIds.value.has(entry.question.id)
}

function toggleExpanded(id: string) {
  const next = new Set(expandedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedIds.value = next
}
</script>

<template>
  <USlideover v-model:open="open" title="Questions" side="right">
    <template #body>
      <p v-if="!entries.length" class="text-sm text-muted">No comments raised on this bundle yet.</p>
      <ul class="space-y-3">
        <li v-for="entry in entries" :key="entry.question.id" class="rounded-lg border border-default p-3 text-sm">
          <div class="mb-1 flex items-center gap-2">
            <UBadge size="sm" variant="subtle" :color="entry.question.kind === 'change-request' ? 'error' : 'info'">
              {{ entry.question.kind === 'change-request' ? 'Change request' : 'Question' }}
            </UBadge>
            <UBadge
              size="sm"
              variant="subtle"
              :color="entry.question.resolved ? 'success' : entry.answer ? 'success' : entry.question.status === 'open' ? 'warning' : 'neutral'"
            >
              {{
                entry.question.resolved
                  ? 'Resolved'
                  : entry.answer
                    ? 'Answered'
                    : entry.question.status === 'open'
                      ? 'Open'
                      : 'Withdrawn'
              }}
            </UBadge>
            <span v-if="entry.filePath" class="truncate font-mono text-xs text-muted">{{ entry.filePath }}</span>
            <UButton
              v-if="entry.question.resolved"
              size="xs"
              variant="ghost"
              class="ml-auto"
              @click="toggleExpanded(entry.question.id)"
            >
              {{ isCollapsed(entry) ? 'Show' : 'Hide' }}
            </UButton>
          </div>

          <template v-if="!isCollapsed(entry)">
            <button
              type="button"
              class="block w-full text-left"
              :disabled="!entry.filePath"
              @click="emit('select', entry)"
            >
              <p class="leading-relaxed" :class="{ 'text-muted line-through': entry.question.status === 'withdrawn' }">
                {{ entry.question.body }}
              </p>
              <div v-if="entry.answer" class="mt-2 border-t border-default pt-2 text-muted">
                <p class="mb-0.5 text-[10px] font-bold">Answer</p>
                <p class="leading-relaxed whitespace-pre-wrap">{{ entry.answer.body }}</p>
              </div>
            </button>
          </template>
          <p v-else class="truncate text-muted italic">{{ entry.question.body }}</p>
        </li>
      </ul>
    </template>
  </USlideover>
</template>
