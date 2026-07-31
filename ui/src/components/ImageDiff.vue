<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { assetUrl } from '../api.ts'

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`failed to load ${src}`))
    img.src = src
  })
}

// Plain <canvas>/ImageData pixel diff — no library. A fixed per-channel delta
// threshold tolerates minor recompression noise without a real perceptual-diff
// algorithm; good enough for "does this snapshot actually differ", not pixel-perfect QA.
const CHANGED_THRESHOLD = 32

async function computeDiff() {
  if (!baseImageUrl.value) return
  // The <canvas> only exists in the DOM for the changed-pixel branch of a v-if/v-else
  // chain — switching into this mode doesn't mean Vue has patched it in yet.
  await nextTick()
  if (!diffCanvas.value) return
  diffLoading.value = true
  diffError.value = null
  diffStats.value = null
  try {
    const [baseImg, headImg] = await Promise.all([loadImage(baseImageUrl.value), loadImage(headUrl.value)])
    if (baseImg.naturalWidth !== headImg.naturalWidth || baseImg.naturalHeight !== headImg.naturalHeight) {
      diffError.value = `Dimensions differ: base ${baseImg.naturalWidth}×${baseImg.naturalHeight} vs head ${headImg.naturalWidth}×${headImg.naturalHeight} — cannot pixel-diff.`
      return
    }
    const width = baseImg.naturalWidth
    const height = baseImg.naturalHeight

    const baseCanvas = document.createElement('canvas')
    baseCanvas.width = width
    baseCanvas.height = height
    const baseCtx = baseCanvas.getContext('2d')!
    baseCtx.drawImage(baseImg, 0, 0)
    const baseData = baseCtx.getImageData(0, 0, width, height)

    const headCanvas = document.createElement('canvas')
    headCanvas.width = width
    headCanvas.height = height
    const headCtx = headCanvas.getContext('2d')!
    headCtx.drawImage(headImg, 0, 0)
    const headData = headCtx.getImageData(0, 0, width, height)

    const out = diffCanvas.value
    out.width = width
    out.height = height
    const outCtx = out.getContext('2d')!
    const outData = outCtx.createImageData(width, height)

    let changed = 0
    for (let i = 0; i < baseData.data.length; i += 4) {
      const delta =
        Math.abs(baseData.data[i] - headData.data[i]) +
        Math.abs(baseData.data[i + 1] - headData.data[i + 1]) +
        Math.abs(baseData.data[i + 2] - headData.data[i + 2])
      if (delta > CHANGED_THRESHOLD) {
        changed++
        outData.data[i] = 255
        outData.data[i + 1] = 0
        outData.data[i + 2] = 0
        outData.data[i + 3] = 255
      } else {
        const gray = (headData.data[i] + headData.data[i + 1] + headData.data[i + 2]) / 3
        outData.data[i] = gray
        outData.data[i + 1] = gray
        outData.data[i + 2] = gray
        outData.data[i + 3] = 90
      }
    }
    outCtx.putImageData(outData, 0, 0)
    diffStats.value = { width, height, changedPercent: (changed / (width * height)) * 100 }
  } catch (err) {
    diffError.value = err instanceof Error ? err.message : String(err)
  } finally {
    diffLoading.value = false
  }
}

watch(mode, (m) => {
  if (m === 'changed-pixel') computeDiff()
})
onMounted(() => {
  if (mode.value === 'changed-pixel') computeDiff()
})

const MODE_LABELS: Record<Mode, string> = {
  'side-by-side': 'Side by side',
  swipe: 'Swipe',
  'onion-skin': 'Onion skin',
  'changed-pixel': 'Changed pixels',
}

// Native <dialog> rather than a custom overlay component — showModal() gives us
// backdrop, ESC-to-close, and focus trapping for free.
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
