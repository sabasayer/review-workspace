<script setup lang="ts">
import type { CodeTarget } from '../types.ts'
import { canJumpToTarget } from '../jump-target.ts'
import { jumpToTarget } from '../composables/jump-to-diff.ts'

defineProps<{ target: CodeTarget }>()
</script>

<template>
  <UButton
    v-if="canJumpToTarget(target)"
    size="xs"
    variant="ghost"
    color="neutral"
    icon="i-lucide-corner-down-right"
    aria-label="Jump to this code in the diff"
    data-testid="jump-to-target"
    @click="jumpToTarget(target)"
  />
</template>
