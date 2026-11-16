<script setup lang="ts">
interface Props {
  shape?: 'plain' | 'circle' | 'square'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  gap?: string
  color?: string
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  shape: 'plain',
  size: 'md',
  gap: 'sm',
  color: undefined,
  align: undefined,
})

definePlutoBlock<Props>({
  label: 'Social icons',
  description: 'A row of links to social networks.',
  icon: 'i-lucide-share-2',
  group: 'landing',
  insert:
    '::block-social-icons\n:::block-social-link{network="github" url="https://github.com"}\n:::\n::',
  props: {
    size: {
      options: ['sm', 'md', 'lg', 'xl'],
    },
    gap: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
    color: {
      description:
        'The color of the icons: a token (primary...) or a CSS color.',
    },
  },
  slots: {
    default: {
      label: 'Links',
      content: 'blocks',
      accepts: ['block-social-link'],
    },
  },
})

const style = computed(() => ({
  '--pluto-blocks-gap': blocksSpace(props.gap),
  '--pluto-blocks-icon-color': blocksColor(props.color),
}))
</script>

<template>
  <ul
    :style="style"
    :data-shape="props.shape"
    :data-size="props.size"
    :data-align="props.align"
    class="pluto-blocks-social-icons"
  >
    <slot />
  </ul>
</template>
