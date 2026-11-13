<script setup lang="ts">
// The viewport div is a block, not Reka's `display: table`, so a long label truncates.
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'
</script>

<template>
  <ScrollAreaRoot
    :scroll-hide-delay="1000"
    type="hover"
    class="relative min-h-0 flex-1 overflow-hidden"
  >
    <ScrollAreaViewport class="size-full px-4 py-2 *:block!">
      <slot />
    </ScrollAreaViewport>

    <ScrollAreaScrollbar
      orientation="vertical"
      class="flex w-2.5 touch-none p-0.5 transition-opacity duration-300! select-none data-[state=hidden]:opacity-0"
      force-mount
    >
      <ScrollAreaThumb
        class="relative flex-1 rounded-full bg-white/20 transition-colors duration-150! hover:bg-white/35"
      />
    </ScrollAreaScrollbar>
  </ScrollAreaRoot>
</template>
