<script setup lang="ts">
// The scroll area of the admin sidebar (the body of UDashboardSidebar in app/layouts/admin.vue),
// with the scrollbar of Reka UI instead of the native one. The sidebar is dark in both modes, so
// the thumb is a light gray. It shows while the pointer is over the sidebar and fades out a moment
// after it leaves (`type="hover"`).
//
// The scrollbar lies over the right padding of the content (the gutter): the rows never move when
// it shows, and it never covers them. The inner `div` of the viewport is a block, not Reka's
// `display: table`, so a long label truncates instead of widening the sidebar.
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

    <!--
      Mounted all the time, so the opacity can fade. The `!` keeps the duration against the
      no-transition rule of the admin (pluto-layer.css).
    -->
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
