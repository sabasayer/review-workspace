<script setup lang="ts">
defineProps<{ suggestion?: string }>()
</script>

<template>
  <div v-if="suggestion" data-testid="note-suggestion" class="mt-2 rounded border border-primary/40 bg-primary/5 p-2">
    <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Suggestion</p>
    <p class="text-default">{{ suggestion }}</p>
  </div>
</template>
