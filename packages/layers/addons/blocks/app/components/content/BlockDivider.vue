<script setup lang="ts">
interface Props {
  line?: 'solid' | 'dashed' | 'dotted'
  color?: string
  thickness?: number
  width?: string | number
  align?: 'start' | 'center' | 'end'
  spacing?: string
}

const props = withDefaults(defineProps<Props>(), {
  line: 'solid',
  color: undefined,
  thickness: 1,
  width: undefined,
  align: 'center',
  spacing: 'sm',
})

definePlutoBlock<Props>({
  label: 'Divider',
  description: 'A horizontal line between two blocks.',
  icon: 'i-lucide-minus',
  group: 'layout',
  props: {
    align: {
      options: ['start', 'center', 'end'],
    },
    color: {
      description: 'A color token (muted...) or a CSS color.',
    },
    thickness: {
      type: 'number',
      description: 'The thickness in pixels.',
    },
    width: {
      description: 'A CSS length, such as 50% or 120px. Empty: the full width.',
    },
    spacing: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      description: 'The space above and below the line.',
    },
  },
})

const style = computed(() => ({
  borderTopWidth: blocksLength(props.thickness),
  borderTopColor: blocksColor(props.color),
  width: blocksLength(props.width),
  marginBlock: blocksSpace(props.spacing),
}))
</script>

<template>
  <hr
    :style="style"
    :data-line="props.line"
    :data-align="props.align"
    class="pluto-blocks-divider"
  />
</template>
