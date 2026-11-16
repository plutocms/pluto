<script setup lang="ts">
import { BLOCKS_LAYOUT_CHILDREN } from '../../utils/blocks-names'

interface Props {
  width?: string | number
  padding?: string
  bg?: string
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end'
  valign?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  width: undefined,
  padding: 'none',
  bg: undefined,
  radius: 'none',
  shadow: 'none',
  align: undefined,
  valign: undefined,
})

definePlutoBlock<Props>({
  label: 'Column',
  description: 'One column of a row. It holds blocks, and more columns.',
  icon: 'i-lucide-columns-2',
  group: 'layout',
  props: {
    width: {
      description:
        'A percent (50, 33.3) or a CSS length. Empty: the column shares the row.',
    },
    padding: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
    bg: {
      description: 'A color token (surface...) or a CSS color.',
    },
  },
  slots: {
    default: {
      label: 'Content',
      content: 'blocks',
      accepts: BLOCKS_LAYOUT_CHILDREN,
    },
  },
})

const basis = computed(() => {
  const percent = blocksPercent(props.width)
  if (percent !== undefined) {
    return `calc(${percent}% - var(--pluto-blocks-gap, 0px) * ${Number((1 - percent / 100).toFixed(4))})`
  }
  return blocksLength(props.width)
})

const style = computed(() => ({
  '--pluto-blocks-basis': basis.value,
  padding: blocksSpace(props.padding),
  backgroundColor: blocksColor(props.bg),
}))
</script>

<template>
  <div
    :style="style"
    :data-sized="basis ? '' : undefined"
    :data-radius="props.radius"
    :data-shadow="props.shadow"
    :data-align="props.align"
    :data-valign="props.valign"
    class="pluto-blocks-column"
  >
    <slot />
  </div>
</template>
