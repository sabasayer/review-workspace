<script setup lang="ts">
import { computed } from 'vue'
import type { GroupBucket } from '../grouped-files.ts'
import type { RenderedFile } from '../types.ts'
import { countVerification } from '../annotation-view.ts'

const props = defineProps<{ groups: GroupBucket[]; files: readonly RenderedFile[] }>()

function anchorId(path: string): string {
  return `file-${path.replace(/[^a-zA-Z0-9]/g, '-')}`
}
function shortName(path: string): string {
  return path.split('/').pop() ?? path
}
function jump(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const riskColor: Record<string, 'error' | 'warning' | 'success'> = { high: 'error', medium: 'warning', low: 'success' }

const verification = computed(() => countVerification(props.files))
const verificationTotal = computed(() => verification.value.verified + verification.value.unverified + verification.value.gap)
</script>

<template>
  <nav class="flex flex-col gap-5">
    <div>
      <p class="mb-2 text-[11px] font-semibold tracking-wide text-dimmed uppercase">Behavioral groups</p>
      <div class="flex flex-col gap-4">
        <div v-for="(entry, i) in groups" :key="entry.group?.id ?? `ungrouped-${i}`">
          <div class="mb-1 flex items-center gap-2">
            <span v-if="entry.group" class="text-xs font-semibold text-highlighted">{{ entry.group.title }}</span>
            <span v-else class="text-xs font-semibold text-muted">Other changes</span>
            <UBadge v-if="entry.group?.risk" :color="riskColor[entry.group.risk]" variant="subtle" size="sm">
              {{ entry.group.risk }}
            </UBadge>
          </div>
          <div class="flex flex-col gap-1">
            <button
              v-for="path in entry.filePaths"
              :key="path"
              type="button"
              class="truncate rounded px-2 py-1 text-left font-mono text-xs text-muted hover:bg-elevated hover:text-highlighted"
              :title="path"
              @click="jump(path)"
            >
              {{ shortName(path) }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="verificationTotal">
      <p class="mb-2 text-[11px] font-semibold tracking-wide text-dimmed uppercase">Verification</p>
      <div class="mb-2 flex h-1.5 overflow-hidden rounded-full bg-elevated">
        <div class="bg-success" :style="{ width: `${(100 * verification.verified) / verificationTotal}%` }" />
        <div class="bg-warning" :style="{ width: `${(100 * verification.unverified) / verificationTotal}%` }" />
        <div class="bg-error" :style="{ width: `${(100 * verification.gap) / verificationTotal}%` }" />
      </div>
      <ul class="space-y-0.5 text-xs">
        <li class="flex justify-between"><span class="text-success">verified</span><span>{{ verification.verified }}</span></li>
        <li class="flex justify-between"><span class="text-warning">unverified</span><span>{{ verification.unverified }}</span></li>
        <li class="flex justify-between"><span class="text-error">gap</span><span>{{ verification.gap }}</span></li>
      </ul>
    </div>
  </nav>
</template>
