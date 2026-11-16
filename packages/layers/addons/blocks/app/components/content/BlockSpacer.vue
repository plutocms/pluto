<script setup lang="ts">
interface Props {
  size?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

definePlutoBlock<Props>({
  label: 'Spacer',
  description: 'Empty vertical space between two blocks.',
  icon: 'i-lucide-move-vertical',
  group: 'layout',
  props: {
    size: {
      type: 'string',
      description:
        'A step (xs, sm, md, lg, xl, 2xl) or a CSS length, such as 40px.',
    },
  },
})

const style = computed(() => ({
  height: blocksSpace(props.size),
}))
</script>

<template>
  <div :style="style" class="pluto-blocks-spacer" aria-hidden="true" />
</template>
