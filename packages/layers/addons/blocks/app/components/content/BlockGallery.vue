<script setup lang="ts">
interface Props {
  columns?: number
  gap?: string
  ratio?: 'auto' | '1:1' | '4:3' | '3:2' | '16:9'
}

const props = withDefaults(defineProps<Props>(), {
  columns: 3,
  gap: 'sm',
  ratio: 'auto',
})

definePlutoBlock<Props>({
  label: 'Gallery',
  description: 'A grid of images.',
  icon: 'i-lucide-images',
  group: 'media',
  insert:
    '::block-gallery{columns="3"}\n:::block-image{src="/images/photo.jpg" alt="A photo"}\n:::\n::',
  props: {
    columns: {
      type: 'number',
      description: 'The number of columns, from 1 to 6. Two on a small screen.',
    },
    gap: {
      type: 'select',
      options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    },
  },
  slots: {
    default: {
      label: 'Images',
      content: 'blocks',
      accepts: ['block-image'],
    },
  },
})

const columns = computed(() =>
  Math.min(6, Math.max(1, Math.round(Number(props.columns)) || 3))
)
const ratio = computed(() =>
  props.ratio === 'auto' ? undefined : props.ratio.replace(':', ' / ')
)

const style = computed(() => ({
  '--pluto-blocks-gap': blocksSpace(props.gap),
  '--pluto-blocks-columns': columns.value,
  '--pluto-blocks-ratio': ratio.value,
}))
</script>

<template>
  <div :style="style" class="pluto-blocks-gallery">
    <slot />
  </div>
</template>
