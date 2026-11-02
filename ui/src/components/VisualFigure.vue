<script setup lang="ts">
import { assetUrl } from '../api.ts'
import type { IntentVisual } from '../types.ts'
import ImageLightbox from './ImageLightbox.vue'

defineProps<{ visual: IntentVisual }>()
</script>

<template>
  <figure data-testid="intent-visual" class="max-w-full" :class="visual.baseAssetPath ? 'w-[36rem]' : 'w-72'">
    <ImageLightbox :asset-path="visual.assetPath" :base-asset-path="visual.baseAssetPath" :caption="visual.caption">
      <div v-if="visual.baseAssetPath" class="grid grid-cols-2 gap-1">
        <div>
          <p class="text-[10px] font-bold text-muted">Before</p>
          <img :src="assetUrl(visual.baseAssetPath)" :alt="`Before: ${visual.caption}`" class="rounded border border-default" />
        </div>
        <div>
          <p class="text-[10px] font-bold text-muted">After</p>
          <img :src="assetUrl(visual.assetPath)" :alt="`After: ${visual.caption}`" class="rounded border border-default" />
        </div>
      </div>
      <img v-else :src="assetUrl(visual.assetPath)" :alt="visual.caption" class="rounded border border-default" />
    </ImageLightbox>
    <figcaption class="mt-1 text-xs text-muted">{{ visual.caption }}</figcaption>
  </figure>
</template>
