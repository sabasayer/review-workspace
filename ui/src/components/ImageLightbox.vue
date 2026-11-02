<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import ImageDiff from './ImageDiff.vue'

const COMPARISON_MODES = ['side-by-side', 'swipe', 'onion-skin', 'changed-pixel'] as const

defineProps<{ assetPath: string; baseAssetPath?: string; caption: string }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const isOpen = ref(false)

function open() {
  isOpen.value = true
  dialog.value?.showModal()
}

function closeOnBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value?.close()
}
</script>

<template>
  <button
    type="button"
    class="block w-full cursor-zoom-in text-left"
    :aria-label="`Enlarge image: ${caption}`"
    data-testid="enlarge-image"
    @click="open"
  >
    <slot />
  </button>
  <dialog
    ref="dialog"
    data-testid="image-lightbox"
    :aria-label="caption"
    class="m-auto max-h-[94vh] w-[min(96vw,90rem)] overflow-auto rounded-lg border border-default bg-default p-0 text-default backdrop:bg-black/80"
    @click="closeOnBackdropClick"
    @close="isOpen = false"
  >
    <div class="flex items-start justify-between gap-3 p-3 pb-0">
      <p class="text-sm font-semibold">{{ caption }}</p>
      <UButton size="xs" variant="soft" color="neutral" @click="dialog?.close()">Close</UButton>
    </div>
    <ImageDiff
      v-if="isOpen"
      large
      :asset-path="assetPath"
      :base-asset-path="baseAssetPath"
      :comparison-modes="[...COMPARISON_MODES]"
      description="Click outside the picture or press Esc to close."
    />
  </dialog>
</template>
