<script setup lang="ts">
import type { Question, Target } from '../types.ts'
import { openComposer, openThread } from '../composables/question-panel-store.ts'
import { commentBadgeClasses, commentGlyph } from '../comment-style.ts'

const props = defineProps<{ target?: Target; questions: readonly Question[] }>()

function ask() {
  openComposer({ target: props.target ?? { type: 'general' } })
}
</script>

<template>
  <span class="inline-flex items-center gap-1 align-middle">
    <button
      v-for="q in questions"
      :key="q.id"
      type="button"
      class="grid h-[18px] w-[18px] place-items-center rounded-full border text-[10px] font-bold transition hover:scale-110"
      :class="commentBadgeClasses(q)"
      :aria-label="`${q.kind === 'change-request' ? 'Change request' : 'Question'}${q.resolved ? ' (resolved)' : ''}: ${q.body}`"
      @click="openThread(q)"
    >
      {{ commentGlyph(q) }}
    </button>

    <button
      type="button"
      class="grid h-[18px] w-[18px] place-items-center rounded-full border border-dimmed/40 text-[10px] text-dimmed opacity-0 transition group-hover:opacity-100 hover:scale-110 hover:border-info hover:text-info focus-visible:opacity-100"
      aria-label="Comment on this"
      @click="ask"
    >
      +
    </button>
  </span>
</template>
