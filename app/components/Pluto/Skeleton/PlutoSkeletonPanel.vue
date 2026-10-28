<script setup lang="ts">
// Placeholder for the left panel of a canvas form (for example the block list
// of the page editor) while the item or the widget code loads. The shape of a
// list panel: a header with the title and its buttons, rows with an icon and a
// title (one row with children under a guide line), and a footer.
defineProps<{
  /** The panel title. It shows as text, so the header does not change. */
  title?: string
}>()

// The title widths of the rows, so the rows do not all look the same.
const rows = ['w-3/4', 'w-1/2', 'w-2/5', 'w-1/2', 'w-1/4', 'w-2/3', 'w-2/5', 'w-1/2']
const children = ['w-1/2', 'w-3/5', 'w-2/3']
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" role="status" :aria-label="title">
    <div class="flex h-12 shrink-0 items-center gap-1 border-b border-default px-3" aria-hidden="true">
      <span v-if="title" class="text-highlighted min-w-0 truncate text-sm font-semibold max-lg:hidden">{{ title }}</span>
      <div class="ms-auto flex items-center gap-1.5">
        <USkeleton class="size-6" />
        <USkeleton class="size-6" />
        <USkeleton class="h-6 w-14" />
        <USkeleton class="size-6" />
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden p-2" aria-hidden="true">
      <div v-for="(width, index) in rows" :key="index" class="flex h-8 items-center gap-2 ps-6">
        <USkeleton class="size-4 shrink-0" />
        <USkeleton :class="width" class="h-3.5" />
      </div>
      <div class="flex h-8 items-center gap-2 ps-6">
        <USkeleton class="size-4 shrink-0" />
        <USkeleton class="h-3.5 w-1/3" />
      </div>
      <div class="ms-7 flex flex-col gap-0.5 border-s border-default ps-1">
        <div v-for="(width, index) in children" :key="index" class="flex h-8 items-center gap-2 ps-5">
          <USkeleton class="size-4 shrink-0" />
          <USkeleton :class="width" class="h-3.5" />
        </div>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1.5 border-t border-default px-3 py-2" aria-hidden="true">
      <USkeleton class="h-6 w-16" />
      <USkeleton class="h-6 w-20" />
    </div>
  </div>
</template>
