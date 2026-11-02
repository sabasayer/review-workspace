<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import type { QuestionEntry } from '../question-entries.ts'
import { closePanel, openThread, panelState } from '../composables/question-panel-store.ts'
import { sortNewestFirst } from '../question-panel.ts'
import QuestionComposer from './QuestionComposer.vue'
import QuestionThreadCard from './QuestionThreadCard.vue'

const props = defineProps<{ entries: QuestionEntry[]; currentRound: number }>()
const emit = defineEmits<{ showInCode: [entry: QuestionEntry] }>()

const threads = computed(() => sortNewestFirst(props.entries))

watch(
  () => panelState.threadId,
  async (id) => {
    if (!id) return
    await nextTick()
    document.getElementById(`thread-${id}`)?.scrollIntoView({ block: 'nearest' })
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <aside
    role="region"
    aria-label="Question panel"
    data-testid="question-panel"
    class="flex h-full min-h-0 w-96 max-w-[90vw] shrink-0 flex-col border-l border-default bg-default"
  >
    <header class="flex shrink-0 items-center gap-2 border-b border-default px-3 py-2">
      <h2 class="text-sm font-semibold">Questions</h2>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        class="ml-auto"
        aria-label="Close the Question panel"
        @click="closePanel"
      />
    </header>

    <div data-testid="thread-list" class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <p v-if="!threads.length" class="text-sm text-muted">No comments raised on this bundle yet.</p>
      <QuestionThreadCard
        v-for="entry in threads"
        :key="entry.question.id"
        :entry="entry"
        :current-round="currentRound"
        :active="panelState.threadId === entry.question.id"
        @open="openThread(entry.question)"
        @show-in-code="emit('showInCode', entry)"
      />
    </div>

    <QuestionComposer class="shrink-0 border-t border-default" />
  </aside>
</template>
