<script setup lang="ts">
import type { Annotation } from '../types.ts'
import { severityColor, severityLabel, sourceLabel, verdictColor, verdictLabel } from '../note-fields.ts'

defineProps<{ annotation: Pick<Annotation, 'verdict' | 'severity' | 'source'> }>()
</script>

<template>
  <span class="inline-flex shrink-0 items-center gap-1.5">
    <UBadge v-if="annotation.verdict" data-testid="note-verdict" size="sm" variant="subtle" :color="verdictColor(annotation.verdict)">
      {{ verdictLabel(annotation.verdict) }}
    </UBadge>
    <UBadge v-if="annotation.severity" data-testid="note-severity" size="sm" variant="outline" :color="severityColor(annotation.severity)">
      {{ severityLabel(annotation.severity) }}
    </UBadge>
    <span v-if="annotation.source" data-testid="note-source" class="text-[10px] text-dimmed">{{ sourceLabel(annotation.source) }}</span>
  </span>
</template>
