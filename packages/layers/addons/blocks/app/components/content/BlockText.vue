<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  align?: 'start' | 'center' | 'end'
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: undefined,
  align: undefined,
  color: undefined,
})

definePlutoBlock<Props>({
  label: 'Text',
  description: 'Rich text: paragraphs, lists, links and more.',
  icon: 'i-lucide-text',
  group: 'text',
  insert: '::block-text\nWrite your text here.\n::',
  props: {
    color: {
      description: 'A color token (primary, muted...) or a CSS color.',
    },
  },
  slots: {
    default: {
      label: 'Text',
      content: 'rich',
    },
  },
})

const style = computed(() => ({
  color: blocksColor(props.color),
}))
</script>

<template>
  <div
    :style="style"
    :data-size="props.size"
    :data-align="props.align"
    class="pluto-blocks-text"
  >
    <slot />
  </div>
</template>
