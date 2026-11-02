<script setup lang="ts">
import type { Intent } from '../types.ts'
import VisualsPanel from './VisualsPanel.vue'

defineProps<{ intent: Intent }>()
</script>

<template>
  <section data-testid="intent-panel" class="mb-4 rounded-lg border border-default bg-elevated p-4 text-sm">
    <h2 class="mb-2 text-base font-semibold">What this change is</h2>
    <p v-if="intent.weakDescription" class="mb-3 rounded border border-warning/50 bg-warning/10 p-2 text-xs">
      The MR text is weak: {{ intent.weakDescription }}
    </p>
    <dl class="space-y-2">
      <div>
        <dt class="text-xs font-semibold uppercase tracking-wide text-muted">What it does</dt>
        <dd>{{ intent.does }}</dd>
      </div>
      <div>
        <dt class="text-xs font-semibold uppercase tracking-wide text-muted">Why</dt>
        <dd>{{ intent.why }}</dd>
      </div>
      <div v-if="intent.doesNot?.length">
        <dt class="text-xs font-semibold uppercase tracking-wide text-muted">What it does not do</dt>
        <dd>
          <ul class="list-disc pl-5">
            <li v-for="item in intent.doesNot" :key="item">{{ item }}</li>
          </ul>
        </dd>
      </div>
    </dl>
    <VisualsPanel :visuals="intent.visuals" />
    <p class="mt-3 text-xs text-muted">Sources: {{ intent.sources.join(', ') }}</p>
  </section>
</template>
