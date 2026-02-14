<script setup lang="ts">
import type { ClassNameValue } from 'tailwind-merge'
import { twMerge } from 'tailwind-merge'

const props = defineProps<{
  class?: ClassNameValue
}>()

const resolvedClasses = computed(() => {
  const defaultClasses = 'mx-auto max-w-full transition-all px-4 sm:px-6 w-350'

  return twMerge([defaultClasses, props.class])
})
</script>

<template>
  <div :class="resolvedClasses">
    <slot />
  </div>
</template>
