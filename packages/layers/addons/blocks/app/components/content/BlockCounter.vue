<script setup lang="ts">
interface Props {
  value?: number
  prefix?: string
  suffix?: string
  title?: string
  color?: string
  align?: 'start' | 'center' | 'end'
}

const props = withDefaults(defineProps<Props>(), {
  value: 0,
  prefix: undefined,
  suffix: undefined,
  title: undefined,
  color: undefined,
  align: undefined,
})

definePlutoBlock<Props>({
  label: 'Counter',
  description: 'A big number with a title, such as 120 projects.',
  icon: 'i-lucide-hash',
  group: 'landing',
  insert: '::block-counter{value="120" suffix="+" title="Projects"}\n::',
  props: {
    value: {
      type: 'number',
    },
    color: {
      description:
        'The color of the number: a token (primary...) or a CSS color.',
    },
  },
})

const style = computed(() => ({
  color: blocksColor(props.color),
}))
</script>

<template>
  <div :data-align="props.align" class="pluto-blocks-counter">
    <p :style="style" class="pluto-blocks-counter__number">
      <span v-if="props.prefix">{{ props.prefix }}</span>
      <span>{{ props.value }}</span>
      <span v-if="props.suffix">{{ props.suffix }}</span>
    </p>

    <p v-if="props.title" class="pluto-blocks-counter__title">
      {{ props.title }}
    </p>
  </div>
</template>
