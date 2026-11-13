<script setup lang="ts">
import {
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from 'reka-ui'

withDefaults(
  defineProps<{
    title: string
    collapse?: boolean
  }>(),
  { collapse: true }
)
</script>

<template>
  <div
    :aria-label="title"
    class="bg-pluto-panel flex min-h-0 flex-1 flex-col"
    role="region"
  >
    <div
      class="border-default flex h-12 shrink-0 items-center gap-1 border-b px-3"
    >
      <h2
        class="text-highlighted min-w-0 truncate text-sm font-semibold max-lg:hidden"
      >
        {{ title }}
      </h2>
      <div class="ms-auto flex items-center gap-1">
        <slot name="actions" />
        <PlutoViewLeftCollapse v-if="collapse" />
      </div>
    </div>

    <ScrollAreaRoot
      type="hover"
      class="relative min-h-0 flex-1 overflow-hidden"
    >
      <ScrollAreaViewport class="size-full">
        <slot />
      </ScrollAreaViewport>
      <ScrollAreaScrollbar
        orientation="vertical"
        class="flex w-2.5 touch-none p-0.5 select-none"
      >
        <ScrollAreaThumb
          class="relative flex-1 rounded-full bg-(--ui-border-accented) hover:bg-(--ui-text-dimmed)"
        />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>

    <div
      v-if="$slots.footer"
      class="border-default flex shrink-0 items-center gap-2 border-t px-3 py-2"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
