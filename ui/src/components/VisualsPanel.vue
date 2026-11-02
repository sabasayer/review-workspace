<script setup lang="ts">
import { computed } from 'vue'
import { selectVisuals } from '../visuals.ts'
import type { IntentVisual } from '../types.ts'
import VisualFigure from './VisualFigure.vue'

const props = defineProps<{ visuals?: readonly IntentVisual[] }>()
const selection = computed(() => selectVisuals(props.visuals))
</script>

<template>
  <aside v-if="selection.shown.length" data-testid="intent-visuals" class="mt-3 flex flex-wrap items-start gap-3">
    <VisualFigure v-for="visual in selection.shown" :key="visual.assetPath" :visual="visual" />
    <details v-if="selection.more.length" data-testid="more-visuals" class="basis-full">
      <summary class="cursor-pointer text-xs text-primary">More images ({{ selection.more.length }})</summary>
      <div class="mt-2 flex flex-wrap items-start gap-3">
        <VisualFigure v-for="visual in selection.more" :key="visual.assetPath" :visual="visual" />
      </div>
    </details>
  </aside>
</template>
