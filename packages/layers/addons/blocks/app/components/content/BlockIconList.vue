<script setup lang="ts">
interface Props {
  icon?: string
  color?: string
  gap?: string
  layout?: 'vertical' | 'inline'
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'i-lucide-check',
  color: undefined,
  gap: 'xs',
  layout: 'vertical',
})

definePlutoBlock<Props>({
  label: 'Icon list',
  description: 'A list where each item has an icon.',
  icon: 'i-lucide-list-checks',
  group: 'landing',
  insert:
    '::block-icon-list\n:::block-icon-list-item\nFirst item\n:::\n:::block-icon-list-item\nSecond item\n:::\n::',
  props: {
    icon: {
      type: 'icon',
      description: 'The icon of the items that have none of their own.',
    },
    color: {
      description:
        'The color of the icons: a token (primary...) or a CSS color.',
    },
    gap: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
  },
  slots: {
    default: {
      label: 'Items',
      content: 'blocks',
      accepts: ['block-icon-list-item'],
    },
  },
})

provide(
  'pluto-blocks-icon-list',
  computed(() => props.icon)
)

const style = computed(() => ({
  '--pluto-blocks-gap': blocksSpace(props.gap),
  '--pluto-blocks-icon-color': blocksColor(props.color),
}))
</script>

<template>
  <ul :style="style" :data-layout="props.layout" class="pluto-blocks-icon-list">
    <slot />
  </ul>
</template>
