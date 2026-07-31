<script setup lang="ts">
import type { Annotation, Diagnostic } from '../types.ts'
import AnnotationBadge from './AnnotationBadge.vue'

defineProps<{ annotations: Annotation[]; diagnostics: Diagnostic[]; numbers: Map<string, number> }>()

function diagnosticLabel(d: Diagnostic): string {
  switch (d.kind) {
    case 'stale-line-target':
      return `Stale annotation: ${d.detail}`
    case 'invalid-field':
      return `Invalid field (${d.instancePath}): ${d.message}`
    case 'unresolved-target':
      return `Unresolved ${d.targetType} target: ${d.detail}`
    case 'missing-asset':
      return `Missing asset: ${d.assetPath}`
    case 'unsafe-asset-path':
      return `Unsafe asset path: ${d.assetPath}`
    case 'disallowed-asset-type':
      return `Disallowed asset type: ${d.assetPath}`
    case 'asset-too-large':
      return `Asset too large (${d.bytes} bytes): ${d.assetPath}`
    case 'dangling-answer':
      return `Answer ${d.answerId} references unknown Question ${d.questionId}`
  }
}
</script>

<template>
  <!--
    A very long line's badges sit far past the right edge of the horizontally-scrollable
    pane by the time you've scrolled to read the code — sticky (not fixed/absolute) keeps
    them pinned at the pane's visible right edge as you scroll, without needing to track
    scroll position in JS or leave the normal text flow.
  -->
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
      :title="diagnosticLabel(d)"
    >
      ⚠
    </UBadge>
  </span>
</template>
