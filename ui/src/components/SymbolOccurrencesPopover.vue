<script setup lang="ts">
import { scrollToLineInFile } from '../question-entries.ts'
import { closeSymbolLookup, symbolLookupState } from '../composables/symbol-lookup-store.ts'

const state = symbolLookupState()

async function goTo(path: string, hunkIndex: number, lineId: string) {
  closeSymbolLookup()
  await scrollToLineInFile(path, hunkIndex, lineId)
}

function onOpenChange(open: boolean) {
  if (!open) closeSymbolLookup()
}
</script>

<template>
  <UPopover :open="state.open" @update:open="onOpenChange">
    <span class="pointer-events-none fixed h-0 w-0" :style="{ left: `${state.x}px`, top: `${state.y}px` }" />
    <template #content>
      <div class="max-h-72 w-80 overflow-y-auto p-2 font-mono text-xs">
        <div class="mb-1 px-1 font-sans text-[10px] text-muted">
          {{ state.occurrences.length }} occurrence{{ state.occurrences.length === 1 ? '' : 's' }} of “{{ state.symbol }}”
        </div>
        <button
          v-for="occ in state.occurrences"
          :key="occ.lineId"
          type="button"
          class="block w-full truncate rounded px-1.5 py-1 text-left hover:bg-elevated"
          @click="goTo(occ.path, occ.hunkIndex, occ.lineId)"
        >
          <span class="text-primary">{{ occ.path }}</span><span class="text-dimmed">:{{ occ.lineNumber }}</span>
          <span class="text-muted"> — {{ occ.text.trim() }}</span>
        </button>
      </div>
    </template>
  </UPopover>
</template>
