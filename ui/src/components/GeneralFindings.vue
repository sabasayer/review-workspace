<script setup lang="ts">
import type { Answer, GeneralAnnotation } from '../types.ts'
import { renderMarkdown } from '../markdown.ts'
import AskQuestionForm from './AskQuestionForm.vue'
import GeneralComments from './GeneralComments.vue'
import NoteSuggestion from './NoteSuggestion.vue'
import NoteVerdict from './NoteVerdict.vue'

defineProps<{ findings: readonly GeneralAnnotation[]; answers: readonly Answer[] }>()
</script>

<template>
  <section v-if="findings.length" id="general-findings" data-testid="general-findings" class="mb-4 rounded-lg border border-default bg-elevated p-4 text-sm">
    <h2 class="mb-2 text-base font-semibold">Findings about the whole change</h2>
    <ul class="space-y-3">
      <li v-for="finding in findings" :key="finding.id" data-testid="general-finding" class="rounded border border-default p-3">
        <NoteVerdict :annotation="finding" />
        <div class="markdown-body mt-1 text-muted" v-html="renderMarkdown(finding.summary)" />
        <NoteSuggestion :suggestion="finding.suggestion" />
        <AskQuestionForm class="mt-2" :target="finding.target" :annotation="finding" />
      </li>
    </ul>
    <GeneralComments :answers="answers" />
  </section>
</template>
