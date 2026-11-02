<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GeneralAnnotation, RenderedFile, RenderedGroup, RenderedSummary } from '../types.ts'
import { anchorId } from '../diff-layout.ts'
import { renderMarkdown } from '../markdown.ts'
import { collectVerificationEntries, countVerification, groupRiskLookup, splitHeadline, startHere } from '../annotation-view.ts'
import { buildStartHereItems } from '../start-here-items.ts'
import { verdictColor, verdictLabel } from '../note-fields.ts'

const props = defineProps<{
  summary?: RenderedSummary
  files: readonly RenderedFile[]
  groups: readonly RenderedGroup[]
  generalAnnotations: readonly GeneralAnnotation[]
  openGaps: number
}>()

const bodyOpen = ref(false)
const headline = computed(() => (props.summary ? splitHeadline(props.summary.text) : { headline: '', body: '' }))

const verification = computed(() => countVerification(props.files))

const startHereEntries = computed(() => {
  const riskOf = groupRiskLookup(props.groups)
  return buildStartHereItems(props.generalAnnotations, startHere(collectVerificationEntries(props.files), riskOf))
})
const VISIBLE_CAP = 5
const visibleStartHere = computed(() => startHereEntries.value.slice(0, VISIBLE_CAP))
const hiddenCount = computed(() => Math.max(0, startHereEntries.value.length - VISIBLE_CAP))

const statusIcon: Record<string, string> = { gap: '⚑', unverified: '○' }
const statusColor: Record<string, 'error' | 'warning'> = { gap: 'error', unverified: 'warning' }

function jumpToGeneralFindings() {
  document.getElementById('general-findings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function jump(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section role="region" aria-label="Verdict" class="mb-6 rounded-lg border border-default bg-elevated p-4">
    <template v-if="summary">
      <h2 class="mb-1 text-base font-bold text-highlighted">{{ headline.headline }}</h2>
      <button v-if="headline.body" type="button" class="mb-3 text-xs text-primary hover:underline" @click="bodyOpen = !bodyOpen">
        {{ bodyOpen ? '▾ hide rest' : '▸ read rest' }}
      </button>
      <div v-if="bodyOpen && headline.body" class="markdown-body mb-3 text-sm text-muted" v-html="renderMarkdown(headline.body)" />
    </template>

    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div>
        <p class="text-2xl font-bold text-success">{{ verification.verified }}</p>
        <p class="text-[11px] tracking-wide text-dimmed uppercase">Resolved</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-error" data-testid="open-gaps">{{ openGaps }}</p>
        <p class="text-[11px] tracking-wide text-dimmed uppercase">Open gaps</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-warning">{{ verification.unverified }}</p>
        <p class="text-[11px] tracking-wide text-dimmed uppercase">Needs eyes</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-highlighted">{{ files.length }}</p>
        <p class="text-[11px] tracking-wide text-dimmed uppercase">Files changed</p>
      </div>
    </div>

    <div v-if="visibleStartHere.length">
      <p class="mb-2 text-[11px] font-semibold tracking-wide text-dimmed uppercase">
        Start here — {{ startHereEntries.length }} item{{ startHereEntries.length === 1 ? '' : 's' }}, ordered by risk
      </p>
      <ol class="space-y-1.5 text-xs">
        <li
          v-for="(item, i) in visibleStartHere"
          :key="item.kind === 'general' ? item.annotation.id : item.entry.verification.id"
          class="flex items-center gap-2"
        >
          <span class="w-4 shrink-0 text-right text-dimmed">{{ i + 1 }}</span>
          <template v-if="item.kind === 'general'">
            <button type="button" class="flex-1 truncate text-left hover:underline" @click="jumpToGeneralFindings">
              {{ splitHeadline(item.annotation.summary).headline }}
            </button>
            <UBadge v-if="item.annotation.verdict" size="sm" variant="subtle" :color="verdictColor(item.annotation.verdict)">
              {{ verdictLabel(item.annotation.verdict) }}
            </UBadge>
            <span class="hidden shrink-0 text-dimmed sm:inline">whole change</span>
          </template>
          <template v-else>
            <button type="button" class="flex-1 truncate text-left hover:underline" @click="jump(item.entry.path)">
              {{ item.entry.verification.description }}
            </button>
            <UBadge size="sm" variant="subtle" :color="statusColor[item.entry.verification.status]">
              {{ statusIcon[item.entry.verification.status] }} {{ item.entry.verification.status }}
            </UBadge>
            <span class="hidden shrink-0 font-mono text-dimmed sm:inline">{{ item.entry.path.split('/').pop() }}</span>
          </template>
        </li>
      </ol>
      <p v-if="hiddenCount" class="mt-1.5 text-[11px] text-dimmed">+{{ hiddenCount }} more not shown</p>
    </div>

    <ul v-if="summary?.highlightPaths.length" class="mt-3 flex flex-wrap gap-2 text-xs">
      <li v-for="path in summary.highlightPaths" :key="path">
        <button type="button" class="font-mono text-primary hover:underline" @click="jump(path)">→ {{ path }}</button>
      </li>
    </ul>
  </section>
</template>
