<script setup lang="ts">
import type { Annotation, Diagnostic } from '../types.ts'
import { formatDiagnosticLabel } from '../diagnostics.ts'
import AnnotationBadge from './AnnotationBadge.vue'

defineProps<{ annotations: Annotation[]; diagnostics: Diagnostic[]; numbers: Map<string, number> }>()
</script>

<template>
  <span
    v-if="annotations.length || diagnostics.length"
    class="sticky right-1 z-10 ml-1 inline-flex items-center gap-1 align-middle"
  >
    <AnnotationBadge v-for="a in annotations" :key="a.id" :annotation="a" :number="numbers.get(a.id) ?? 0" />
    <UBadge
      v-for="(d, i) in diagnostics"
      :key="i"
      color="warning"
      variant="subtle"
      size="sm"
      class="ml-1"
      :title="formatDiagnosticLabel(d)"
    >
      ⚠
    </UBadge>
  </span>
</template>
