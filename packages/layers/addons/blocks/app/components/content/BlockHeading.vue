<script setup lang="ts">
interface Props {
  level?: string | number
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
  align?: 'start' | 'center' | 'end'
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  level: 2,
  size: undefined,
  align: undefined,
  color: undefined,
})

definePlutoBlock<Props>({
  label: 'Heading',
  description: 'A heading from level 1 to 6.',
  icon: 'i-lucide-heading',
  group: 'text',
  insert: '::block-heading{level="2"}\nA heading\n::',
  props: {
    level: {
      type: 'select',
      options: ['1', '2', '3', '4', '5', '6'],
      description: 'The level of the heading element, h1 to h6.',
    },
    size: {
      description: 'The look of the heading. Empty: the size of its level.',
    },
    color: {
      description: 'A color token (primary, muted...) or a CSS color.',
    },
  },
  slots: {
    default: {
      label: 'Text',
      content: 'inline',
    },
  },
})

const tag = computed(() => `h${blocksLevel(props.level)}`)

const style = computed(() => ({
  color: blocksColor(props.color),
}))
</script>

<template>
  <component
    :is="tag"
    :style="style"
    :data-size="props.size"
    :data-align="props.align"
    class="pluto-blocks-heading"
  >
    <BlockInline><slot /></BlockInline>
  </component>
</template>
