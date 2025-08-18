<script setup lang="ts">
import type { ClassNameValue } from 'tailwind-merge'
import { twMerge } from 'tailwind-merge'

interface Props {
  hideCloseButton?: boolean
  hideDivider?: boolean | null
  class?: ClassNameValue
}

const props = withDefaults(defineProps<Props>(), {
  hideCloseButton: false,
  hideDivider: false,
  class: '',
})

const emit = defineEmits(['close'])

const closeModel = defineModel<() => void>('close')

const resolvedClasses = computed(() => {
  const defaultClasses = `
      sticky -top-4 left-0
      z-51
      -mx-4 -mt-4
      flex flex-col gap-x-6
      w-[calc(100%_+_2rem)]
      px-4
      rounded-t-lg
    `

  return twMerge([defaultClasses, props.class])
})

function closeModal() {
  emit('close')

  closeModel.value?.()
}
</script>

<template>
  <div :class="resolvedClasses">
    <div
      class="absolute top-0 left-0 z-[-1] h-full w-full rounded-t-3xl bg-(--ui-bg) backdrop-blur-md"
    />

    <div class="flex items-center justify-between py-4">
      <h2 :class="twMerge(['text-3xl leading-10 font-medium'])">
        <slot />
      </h2>

      <div v-if="props.hideCloseButton === false">
        <UButton class="top-3" size="sm" variant="ghost" @click="closeModal">
          <span class="sr-only">Close</span>

          <Icon name="lucide:x" class="text-2xl" />
        </UButton>
      </div>
    </div>

    <USeparator v-if="props.hideDivider === false" color="neutral" />
  </div>
</template>
