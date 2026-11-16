<script setup lang="ts">
interface Props {
  gap?: string
  valign?: 'start' | 'center' | 'end' | 'stretch'
  wrap?: boolean
  stack?: 'md' | 'sm' | 'never'
}

const props = withDefaults(defineProps<Props>(), {
  gap: 'md',
  valign: 'stretch',
  wrap: true,
  stack: 'md',
})

definePlutoBlock<Props>({
  label: 'Columns',
  description: 'A row of columns. The columns stack on a small screen.',
  icon: 'i-lucide-columns-3',
  group: 'layout',
  insert: '::block-columns\n:::block-column\n:::\n:::block-column\n:::\n::',
  props: {
    gap: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
      description: 'The space between the columns.',
    },
    valign: {
      options: ['start', 'center', 'end', 'stretch'],
      description: 'How the columns line up when they have different heights.',
    },
    stack: {
      description:
        'The screen width below which the columns stack: md (768px), sm (640px) or never.',
    },
  },
  slots: {
    default: {
      label: 'Columns',
      content: 'blocks',
      accepts: ['block-column'],
    },
  },
})

const style = computed(() => ({
  '--pluto-blocks-gap': blocksSpace(props.gap),
}))
</script>

<template>
  <div
    :style="style"
    :data-valign="props.valign"
    :data-wrap="props.wrap ? 'true' : 'false'"
    :data-stack="props.stack"
    class="pluto-blocks-columns"
  >
    <slot />
  </div>
</template>
