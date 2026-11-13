<script setup lang="ts">
import type { PlutoField } from '../../../../shared/types/content'

const props = defineProps<{
  field?: PlutoField
  fieldType?: string
}>()

const type = computed(() => props.field?.type ?? props.fieldType ?? 'text')
const hasDescription = computed(() => Boolean(props.field?.description))
const multipleMedia = computed(
  () => props.field?.type === 'media' && Boolean(props.field.multiple)
)
</script>

<template>
  <div class="flex flex-col gap-2" aria-hidden="true">
    <div class="flex flex-col gap-1.5">
      <USkeleton class="h-4 w-28" />
      <USkeleton v-if="hasDescription" class="h-3.5 w-3/5" />
    </div>

    <USkeleton v-if="type === 'boolean'" class="h-6 w-11 rounded-full" />

    <USkeleton v-else-if="type === 'textarea'" class="h-28 w-full" />

    <div
      v-else-if="type === 'richtext'"
      class="ring-default flex flex-col overflow-hidden rounded-md ring"
    >
      <div class="border-default flex items-center gap-1.5 border-b p-2">
        <USkeleton v-for="n in 7" :key="n" class="size-6" />
      </div>
      <div class="flex flex-col gap-2.5 p-4">
        <USkeleton class="h-4 w-11/12" />
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-4/5" />
        <USkeleton class="mt-2 h-4 w-full" />
        <USkeleton class="h-4 w-2/3" />
      </div>
    </div>

    <div
      v-else-if="type === 'media' && multipleMedia"
      class="flex flex-col gap-4 lg:flex-row lg:items-start"
    >
      <USkeleton class="aspect-square w-full max-w-96 shrink-0" />
      <div class="flex gap-2 lg:flex-col">
        <USkeleton v-for="n in 3" :key="n" class="size-14" />
      </div>
    </div>
    <USkeleton
      v-else-if="type === 'media'"
      class="aspect-video w-full max-w-sm"
    />

    <template v-else-if="type === 'slug'">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-3 w-40" />
    </template>

    <USkeleton v-else class="h-10 w-full" />
  </div>
</template>
