<template>
  <div class="flex flex-col gap-8 py-1">
    <div
      v-if="$slots.header"
      :class="twMerge(['bg-opacity-90 sticky z-[50] backdrop-blur-md'])"
      style="top: var(--header-top-offset)"
    >
      <slot name="header" />
    </div>

    <div class="px-1 pt-6">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { twMerge } from 'tailwind-merge'
</script>

<style scoped>
  * {
    --header-padding: 1rem;
    --header-height: 4.625rem;
    --header-top-offset: calc(var(--header-height) - var(--header-padding));
  }
</style>
