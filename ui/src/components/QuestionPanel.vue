<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import type { QuestionEntry } from '../question-entries.ts'
import { closePanel, openThread, panelState, setPanelTab } from '../composables/question-panel-store.ts'
import { entriesForTab, nextTab, sortNewestFirst, TAB_PANEL_ID, tabId, tabViews } from '../question-panel.ts'
import QuestionComposer from './QuestionComposer.vue'
import QuestionThreadCard from './QuestionThreadCard.vue'

const props = defineProps<{ entries: QuestionEntry[]; currentRound: number }>()
const emit = defineEmits<{ showInCode: [entry: QuestionEntry] }>()

const tabs = computed(() => tabViews(props.entries))
const threads = computed(() => sortNewestFirst(entriesForTab(props.entries, panelState.tab)))
const emptyText = computed(() => tabs.value.find((t) => t.value === panelState.tab)?.emptyText ?? '')

function onTabKeydown(event: KeyboardEvent) {
  const next = nextTab(panelState.tab, event.key)
  if (!next) return
  event.preventDefault()
  setPanelTab(next)
  document.getElementById(tabId(next))?.focus()
}

watch(
  () => [panelState.threadId, panelState.tab] as const,
  async ([id]) => {
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

    <div role="tablist" aria-label="Comment kind" class="flex shrink-0 border-b border-default" @keydown="onTabKeydown">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :id="tabId(tab.value)"
        :aria-controls="TAB_PANEL_ID"
        :tabindex="panelState.tab === tab.value ? 0 : -1"
        :aria-selected="panelState.tab === tab.value"
        class="flex-1 border-b-2 px-3 py-2 text-sm"
        :class="panelState.tab === tab.value ? 'border-primary font-semibold' : 'border-transparent text-muted'"
        @click="setPanelTab(tab.value)"
      >
        {{ tab.label }}<template v-if="tab.count > 0"> {{ tab.count }}</template>
      </button>
    </div>

    <div
      :id="TAB_PANEL_ID"
      role="tabpanel"
      :aria-labelledby="tabId(panelState.tab)"
      data-testid="thread-list"
      class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <p v-if="!threads.length" class="text-sm text-muted">{{ emptyText }}</p>
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
