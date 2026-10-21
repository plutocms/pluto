<script setup lang="ts">
// Placeholder for one content field while its widget code loads. Core shows
// it. A layer needs only `defineAsyncComponent` to get it. Rich text and
// media fields are taller than a single-line input.
const props = defineProps<{
  fieldType?: string
}>()

const tall = computed(() => props.fieldType === 'richtext' || props.fieldType === 'media')
</script>

<template>
  <div class="flex flex-col gap-2" aria-hidden="true">
    <USkeleton class="h-4 w-28" />
    <USkeleton :class="tall ? 'h-48' : 'h-8'" class="w-full" />
  </div>
</template>
