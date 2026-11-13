<script setup lang="ts">
withDefaults(
  defineProps<{
    height?: string
    variant?: 'card' | 'panel'
  }>(),
  { height: '12rem', variant: 'card' }
)
</script>

<template>
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
