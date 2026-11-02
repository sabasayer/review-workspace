<script setup lang="ts">
import { anchorId } from '../diff-layout.ts'
import { proofBackLinkLabel } from '../proof-links.ts'
import type { RenderedProofBackLink } from '../types.ts'

defineProps<{ links: readonly RenderedProofBackLink[] }>()

function jump(path: string) {
  document.getElementById(anchorId(path))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div v-if="links.length" data-testid="proof-back-links" class="flex flex-wrap items-center gap-3 border-b border-default bg-elevated/50 px-4 py-2 text-xs text-muted">
    <span>This image shows that this code works:</span>
    <button v-for="link in links" :key="link.evidenceId + link.path" type="button" class="font-mono text-primary hover:underline" @click="jump(link.path)">
      → {{ proofBackLinkLabel(link) }}
    </button>
  </div>
</template>
