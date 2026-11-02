<script setup lang="ts">
import type { ViewModel } from '../types.ts'
import GeneralFindings from './GeneralFindings.vue'
import IntentPanel from './IntentPanel.vue'
import VerdictPanel from './VerdictPanel.vue'

defineProps<{ viewModel: ViewModel }>()
</script>

<template>
  <section aria-labelledby="before-you-read" data-testid="before-you-read">
    <h2 id="before-you-read" class="mb-3 text-lg font-bold text-highlighted">Before you read the code</h2>
    <IntentPanel v-if="viewModel.intent" :intent="viewModel.intent" />
    <GeneralFindings :findings="viewModel.generalAnnotations" :answers="viewModel.answers" />
    <VerdictPanel
      v-if="viewModel.summary || viewModel.generalAnnotations.length"
      :summary="viewModel.summary"
      :files="viewModel.files"
      :groups="viewModel.groups"
      :general-annotations="viewModel.generalAnnotations"
      :open-gaps="viewModel.openGaps"
    />
  </section>
</template>
