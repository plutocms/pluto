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
  <!-- The shape of a dashboard card: a header with a title and a subtitle, then the body. -->
  <UCard
    v-if="variant === 'card'"
    :style="{ height }"
    class="w-full"
    aria-hidden="true"
  >
    <template #header>
      <div class="flex flex-col gap-1.5">
        <USkeleton class="h-4 w-32" />
        <USkeleton class="h-3.5 w-48" />
      </div>
    </template>
    <div class="flex flex-col gap-3">
      <USkeleton class="h-4 w-full" />
      <USkeleton class="h-4 w-4/5" />
      <USkeleton class="h-4 w-3/5" />
    </div>
  </UCard>

  <div
    v-else
    :style="{ height }"
    class="flex flex-col gap-3"
    aria-hidden="true"
  >
    <USkeleton class="h-4 w-40" />
    <USkeleton class="h-8 w-full" />
  </div>
</template>
