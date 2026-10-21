<script setup lang="ts">
// Placeholder for a dashboard widget or a settings panel while its code
// loads. The height is fixed, so the layout does not shift when the real
// component replaces it. Core shows it.
withDefaults(
  defineProps<{
    /** A CSS length for the block height. */
    height?: string
    /** `card` draws its own card. `panel` sits inside a card that exists. */
    variant?: 'card' | 'panel'
  }>(),
  { height: '12rem', variant: 'card' }
)
</script>

<template>
  <UCard v-if="variant === 'card'" :style="{ height }" class="w-full" aria-hidden="true">
    <div class="flex flex-col gap-3">
      <USkeleton class="h-4 w-32" />
      <USkeleton class="h-3 w-48" />
      <USkeleton class="h-16 w-full" />
    </div>
  </UCard>

  <div v-else :style="{ height }" class="flex flex-col gap-3" aria-hidden="true">
    <USkeleton class="h-4 w-40" />
    <USkeleton class="h-8 w-full" />
  </div>
</template>
