<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { assetUrl } from '../api.ts'
import { computePixelDiff, loadImage } from '../image-pixel-diff.ts'

const props = defineProps<{
  assetPath: string
  baseAssetPath?: string
  comparisonModes: Array<'side-by-side' | 'swipe' | 'onion-skin' | 'changed-pixel'>
  description: string
}>()

type Mode = 'side-by-side' | 'swipe' | 'onion-skin' | 'changed-pixel'

const mode = ref<Mode>(props.comparisonModes[0] ?? 'side-by-side')
const sliderValue = ref(50)

const headUrl = computed(() => assetUrl(props.assetPath))
const baseImageUrl = computed(() => (props.baseAssetPath ? assetUrl(props.baseAssetPath) : null))

const diffCanvas = useTemplateRef<HTMLCanvasElement>('diffCanvas')
const diffStats = ref<{ width: number; height: number; changedPercent: number } | null>(null)
const diffError = ref<string | null>(null)
const diffLoading = ref(false)

async function runPixelDiff() {
  if (!baseImageUrl.value) return
  await nextTick()
  if (!diffCanvas.value) return
  diffLoading.value = true
  diffError.value = null
  diffStats.value = null
  try {
    const [baseImg, headImg] = await Promise.all([loadImage(baseImageUrl.value), loadImage(headUrl.value)])
    const result = computePixelDiff(baseImg, headImg, diffCanvas.value)
    if ('error' in result) diffError.value = result.error
    else diffStats.value = result
  } catch (err) {
    diffError.value = err instanceof Error ? err.message : String(err)
  } finally {
    diffLoading.value = false
  }
}

watch(mode, (m) => {
  if (m === 'changed-pixel') runPixelDiff()
})
onMounted(() => {
  if (mode.value === 'changed-pixel') runPixelDiff()
})

const MODE_LABELS: Record<Mode, string> = {
  'side-by-side': 'Side by side',
  swipe: 'Swipe',
  'onion-skin': 'Onion skin',
  'changed-pixel': 'Changed pixels',
}

const lightboxSrc = ref<string | null>(null)
const lightboxDialog = useTemplateRef<HTMLDialogElement>('lightboxDialog')

function openLightbox(src: string) {
  lightboxSrc.value = src
  lightboxDialog.value?.showModal()
}

function closeLightbox() {
  lightboxDialog.value?.close()
  lightboxSrc.value = null
}
</script>

<template>
  <div class="border-t border-default p-4">
    <p class="mb-3 text-xs text-muted">{{ description }}</p>

    <div v-if="!baseImageUrl" class="max-w-md">
      <img
        :src="headUrl"
        :alt="assetPath"
        class="cursor-zoom-in rounded border border-default"
        @click="openLightbox(headUrl)"
      />
    </div>

    <div v-else>
      <div class="mb-3 flex gap-2">
        <UButton
          v-for="m in comparisonModes"
          :key="m"
          size="xs"
          :variant="mode === m ? 'solid' : 'outline'"
          @click="mode = m"
        >
          {{ MODE_LABELS[m] }}
        </UButton>
      </div>

      <div v-if="mode === 'side-by-side'" class="flex gap-3">
        <div class="max-w-md flex-1">
          <div class="mb-1 text-[10px] font-bold text-muted">Base</div>
          <img
            :src="baseImageUrl"
            :alt="`${assetPath} (base)`"
            class="w-full cursor-zoom-in rounded border border-default"
            @click="openLightbox(baseImageUrl!)"
          />
        </div>
        <div class="max-w-md flex-1">
          <div class="mb-1 text-[10px] font-bold text-muted">Head</div>
          <img
            :src="headUrl"
            :alt="`${assetPath} (head)`"
            class="w-full cursor-zoom-in rounded border border-default"
            @click="openLightbox(headUrl)"
          />
        </div>
      </div>

      <div v-else-if="mode === 'swipe'" class="max-w-2xl">
        <div class="relative inline-block overflow-hidden rounded border border-default">
          <img
            :src="baseImageUrl"
            :alt="`${assetPath} (base)`"
            class="block max-w-full cursor-zoom-in"
            @click="openLightbox(baseImageUrl!)"
          />
          <div class="absolute inset-0 overflow-hidden" :style="{ clipPath: `inset(0 ${100 - sliderValue}% 0 0)` }">
            <img
              :src="headUrl"
              :alt="`${assetPath} (head)`"
              class="block max-w-full cursor-zoom-in"
              @click="openLightbox(headUrl)"
            />
          </div>
          <div class="pointer-events-none absolute inset-y-0 w-0.5 bg-primary" :style="{ left: `${sliderValue}%` }" />
        </div>
        <input v-model.number="sliderValue" type="range" min="0" max="100" class="mt-2 w-full" />
        <p class="mt-1 text-[10px] text-muted">Left of the line: head. Right of the line: base.</p>
      </div>

      <div v-else-if="mode === 'onion-skin'" class="max-w-2xl">
        <div class="relative inline-block overflow-hidden rounded border border-default">
          <img
            :src="baseImageUrl"
            :alt="`${assetPath} (base)`"
            class="block max-w-full cursor-zoom-in"
            @click="openLightbox(baseImageUrl!)"
          />
          <img
            :src="headUrl"
            :alt="`${assetPath} (head)`"
            class="absolute inset-0 block max-w-full cursor-zoom-in"
            :style="{ opacity: sliderValue / 100 }"
            @click="openLightbox(headUrl)"
          />
        </div>
        <input v-model.number="sliderValue" type="range" min="0" max="100" class="mt-2 w-full" />
        <p class="mt-1 text-[10px] text-muted">{{ sliderValue }}% head opacity over base.</p>
      </div>

      <div v-else class="max-w-2xl">
        <p v-if="diffLoading" class="text-xs text-muted">Computing pixel diff…</p>
        <p v-else-if="diffError" class="text-xs text-warning">{{ diffError }}</p>
        <p v-else-if="diffStats" class="mb-2 text-xs text-muted">
          {{ diffStats.width }}×{{ diffStats.height }} — {{ diffStats.changedPercent.toFixed(2) }}% pixels changed
          (red = changed, threshold-based, not pixel-perfect)
        </p>
        <canvas ref="diffCanvas" class="max-w-full rounded border border-default"></canvas>
      </div>
    </div>

    <dialog
      ref="lightboxDialog"
      class="max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 backdrop:bg-black/80"
      @click="closeLightbox"
      @close="lightboxSrc = null"
    >
      <img v-if="lightboxSrc" :src="lightboxSrc" alt="" class="max-h-[92vh] max-w-[92vw] cursor-zoom-out object-contain" />
    </dialog>
  </div>
</template>
