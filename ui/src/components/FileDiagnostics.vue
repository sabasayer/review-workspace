<script setup lang="ts">
import { formatDiagnosticLabel } from '../diagnostics.ts'
import type { Diagnostic } from '../types.ts'

defineProps<{ diagnostics: readonly Diagnostic[] }>()
</script>

<template>
  <div v-if="diagnostics.length" class="border-b border-default bg-warning/10 px-4 py-2 text-xs">
    <strong>{{ diagnostics.length }} diagnostic{{ diagnostics.length === 1 ? '' : 's' }} on this file</strong>
    <ul class="mt-1 list-disc space-y-1 pl-4" data-testid="file-diagnostics">
      <li v-for="(diagnostic, i) in diagnostics" :key="i">{{ formatDiagnosticLabel(diagnostic) }}</li>
    </ul>
  </div>
</template>
