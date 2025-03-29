<template>
  <div :class="resolvedClasses">
    <USeparator v-if="!props.hideDivider" />

    <div
      :class="
        twMerge([
          'bg-opacity-90 absolute top-0 left-0 z-[-1] h-full w-full backdrop-blur-md',
          'bg-(--ui-bg)',
        ])
      "
    />

    <div class="flex py-4" :class="resolvedAlign">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { twMerge, type ClassNameValue } from 'tailwind-merge'

  interface Props {
    align?: 'left' | 'center' | 'right'
    hideDivider?: boolean
    class?: ClassNameValue
  }

  const props = withDefaults(defineProps<Props>(), {
    align: 'center',
    hideDivider: false,
    class: '',
  })

  const resolvedAlign = computed(() => {
    if (props.align === 'left') return 'justify-start'
    if (props.align === 'center') return 'justify-center'
    if (props.align === 'right') return 'justify-end'

    return 'justify-center'
  })

  const resolvedClasses = computed(() => {
    const defaultClasses = `
      sticky -bottom-4 z-51
      -mx-4
      w-[calc(100%_+_2rem)]
      px-4
      mt-8
    `

    return twMerge([defaultClasses, props.class])
  })
</script>
