<script setup lang="ts">
import type { Comparison } from '../types.ts'

defineProps<{
  headerTitle: string
  comparison: Comparison | null
  hasMrMetadata: boolean
  navVisible: boolean
  layout: 'inline' | 'side-by-side'
  openQuestionCount: number
  promptCopied: boolean
  hasWriteToken: boolean
  writeTokenDraft: string
}>()

const emit = defineEmits<{
  'update:navVisible': [visible: boolean]
  'update:layout': [layout: 'inline' | 'side-by-side']
  'update:writeTokenDraft': [token: string]
  openQuestions: []
  openMrDetails: []
  copyPrompt: []
  saveWriteToken: [close: () => void]
}>()
</script>

<template>
  <header class="flex items-center gap-3 border-b border-default px-4 py-3">
    <UTooltip :text="navVisible ? 'Hide file list' : 'Show file list'">
      <UButton
        size="sm"
        color="neutral"
        :variant="navVisible ? 'subtle' : 'ghost'"
        icon="i-lucide-panel-left"
        :aria-pressed="navVisible"
        @click="emit('update:navVisible', !navVisible)"
      />
    </UTooltip>

    <div v-if="comparison" class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="truncate text-sm font-semibold">{{ headerTitle }}</h1>
        <UButton
          v-if="hasMrMetadata"
          size="xs"
          variant="soft"
          color="primary"
          icon="i-lucide-file-text"
          @click="emit('openMrDetails')"
        >
          Details
        </UButton>
      </div>
      <div v-if="hasMrMetadata" class="mt-0.5 flex items-center gap-2 text-xs text-muted">
        <a
          v-if="comparison.url"
          :href="comparison.url"
          target="_blank"
          rel="noopener"
          class="truncate text-primary hover:underline"
        >
          {{ comparison.url }}
        </a>
        <span v-if="comparison.sourceBranch" class="shrink-0 font-mono">
          {{ comparison.sourceBranch }} → {{ comparison.targetBranch ?? 'main' }}
        </span>
      </div>
    </div>
    <h1 v-else class="truncate text-sm font-semibold">{{ headerTitle }}</h1>

    <div class="ml-auto flex items-center gap-3">
      <UTooltip v-if="comparison" text="All questions">
        <UChip :text="openQuestionCount" :show="openQuestionCount > 0" color="warning" size="sm">
          <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-message-circle-question" @click="emit('openQuestions')" />
        </UChip>
      </UTooltip>

      <div class="h-5 w-px bg-default" />

      <UFieldGroup size="sm">
        <UTooltip text="Inline diff">
          <UButton
            icon="i-lucide-align-justify"
            :variant="layout === 'inline' ? 'solid' : 'outline'"
            color="neutral"
            @click="emit('update:layout', 'inline')"
          />
        </UTooltip>
        <UTooltip text="Side-by-side diff">
          <UButton
            icon="i-lucide-columns-2"
            :variant="layout === 'side-by-side' ? 'solid' : 'outline'"
            color="neutral"
            @click="emit('update:layout', 'side-by-side')"
          />
        </UTooltip>
      </UFieldGroup>

      <div class="h-5 w-px bg-default" />

      <UTooltip v-if="comparison" :text="promptCopied ? 'Copied!' : 'Copy Generator prompt'">
        <UButton
          size="sm"
          variant="ghost"
          :color="promptCopied ? 'success' : 'neutral'"
          :icon="promptCopied ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
          @click="emit('copyPrompt')"
        />
      </UTooltip>

      <div class="h-5 w-px bg-default" />

      <UPopover>
        <UTooltip :text="hasWriteToken ? 'Write token set' : 'Set write token'">
          <UButton size="sm" variant="ghost" :color="hasWriteToken ? 'primary' : 'warning'" icon="i-lucide-key" />
        </UTooltip>
        <template #content="{ close }">
          <div class="w-80 p-3">
            <p class="mb-2 text-xs text-muted">
              Paste the write token printed by <code class="font-mono">review-workspace serve</code>. Needed to raise
              Questions or change Review State — read-only viewing works without it.
            </p>
            <UInput
              :model-value="writeTokenDraft"
              size="sm"
              class="w-full"
              placeholder="write token"
              @update:model-value="emit('update:writeTokenDraft', $event)"
              @keyup.enter="emit('saveWriteToken', close)"
            />
            <UButton size="sm" class="mt-2" block @click="emit('saveWriteToken', close)">Save</UButton>
          </div>
        </template>
      </UPopover>

      <UTooltip text="Toggle color mode">
        <UColorModeButton size="sm" />
      </UTooltip>
    </div>
  </header>
</template>
