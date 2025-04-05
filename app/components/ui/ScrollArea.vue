<template>
  <RekaScrollAreaRoot
    :scroll-hide-delay="props.hideDelay"
    class="h-full shrink-0 overflow-hidden transition-opacity duration-300"
  >
    <RekaScrollAreaViewport :class="resolvedClasses">
      <slot />
    </RekaScrollAreaViewport>

    <Transition name="fade">
      <RekaScrollAreaScrollbar
        :class="resolvedTrackClasses"
        orientation="vertical"
      >
        <RekaScrollAreaThumb :class="resolvedThumbClasses" />
      </RekaScrollAreaScrollbar>
    </Transition>

    <RekaScrollAreaCorner />
  </RekaScrollAreaRoot>
</template>

<script setup lang="ts">
  import { twMerge, type ClassNameValue } from 'tailwind-merge'

  interface Props {
    class?: ClassNameValue
    trackClass?: ClassNameValue
    thumbClass?: ClassNameValue
    hideDelay?: number
  }

  const props = withDefaults(defineProps<Props>(), {
    hideDelay: 0,
    class: '',
    thumbClass: '',
    trackClass: '',
  })

  const resolvedClasses = computed(() => {
    const defaultClasses = `
      h-full
      transition-opacity
      duration-300
    `

    return twMerge([defaultClasses, props.class])
  })

  const resolvedTrackClasses = computed(() => {
    const defaultClasses = `
      relative
      w-2
      rounded-full
      bg-transparent
      transition-colors duration-300
      hover:bg-black/10
    `

    return twMerge([defaultClasses, props.trackClass])
  })

  const resolvedThumbClasses = computed(() => {
    const defaultClasses = `
      rounded-full
      bg-black/40
      hover:bg-black/40
      active:bg-black/60
    `

    return twMerge([defaultClasses, props.thumbClass])
  })
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.2s;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
