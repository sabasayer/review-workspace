<script setup lang="ts">
import { assetUrl } from '../api.ts'
import { anchorId } from '../diff-layout.ts'
import type { RenderedProof } from '../types.ts'
import ImageLightbox from './ImageLightbox.vue'

defineProps<{ proofs: readonly RenderedProof[] }>()

function jumpToImage(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <UPopover v-if="proofs.length">
    <UButton
      data-testid="proof-icon"
      size="xs"
      variant="ghost"
      color="primary"
      icon="i-lucide-image"
      :aria-label="`Proof: ${proofs.length} image${proofs.length === 1 ? '' : 's'} show this change works`"
    />
    <template #content>
      <div class="max-h-96 w-80 space-y-3 overflow-y-auto p-3 text-xs" data-testid="proof-popover">
        <figure v-for="proof in proofs" :key="proof.evidenceId">
          <ImageLightbox :asset-path="proof.assetPath" :base-asset-path="proof.baseAssetPath" :caption="proof.caption">
            <div v-if="proof.baseAssetPath" class="grid grid-cols-2 gap-1">
              <img :src="assetUrl(proof.baseAssetPath)" :alt="`Before: ${proof.caption}`" class="rounded border border-default" />
              <img :src="assetUrl(proof.assetPath)" :alt="`After: ${proof.caption}`" class="rounded border border-default" />
            </div>
            <img v-else :src="assetUrl(proof.assetPath)" :alt="proof.caption" class="rounded border border-default" />
          </ImageLightbox>
          <figcaption class="mt-1 text-muted">{{ proof.caption }}</figcaption>
          <button type="button" class="mt-0.5 font-mono text-primary hover:underline" @click="jumpToImage(proof.imagePath)">
            → {{ proof.imagePath }}
          </button>
        </figure>
      </div>
    </template>
  </UPopover>
</template>
