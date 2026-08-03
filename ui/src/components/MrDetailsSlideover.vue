<script setup lang="ts">
import type { Comparison } from '../types.ts'

defineProps<{ comparison: Comparison; descriptionHtml: string }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <USlideover v-model:open="open" :title="comparison.title || 'MR details'" side="right">
    <template #body>
      <div class="space-y-4 text-sm">
        <div v-if="comparison.number" class="text-muted">!{{ comparison.number }}</div>
        <a
          v-if="comparison.url"
          :href="comparison.url"
          target="_blank"
          rel="noopener"
          class="block truncate text-primary hover:underline"
        >
          {{ comparison.url }}
        </a>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
          <template v-if="comparison.author">
            <dt>Author</dt>
            <dd class="text-default">{{ comparison.author }}</dd>
          </template>
          <template v-if="comparison.sourceBranch || comparison.targetBranch">
            <dt>Branch</dt>
            <dd class="text-default font-mono">
              {{ comparison.sourceBranch ?? '?' }} → {{ comparison.targetBranch ?? '?' }}
            </dd>
          </template>
          <template v-if="comparison.repository">
            <dt>Repository</dt>
            <dd class="text-default">{{ comparison.repository }}</dd>
          </template>
        </dl>
        <div v-if="descriptionHtml" class="markdown-body border-t border-default pt-4" v-html="descriptionHtml" />
      </div>
    </template>
  </USlideover>
</template>
