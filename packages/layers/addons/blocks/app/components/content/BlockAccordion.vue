<script setup lang="ts">
interface Props {
  single?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  single: false,
})

definePlutoBlock<Props>({
  label: 'Accordion',
  description: 'A list of questions that open to show the answer.',
  icon: 'i-lucide-chevrons-up-down',
  group: 'landing',
  insert:
    '::block-accordion\n:::block-accordion-item{title="A question"}\nThe answer.\n:::\n::',
  props: {
    single: {
      description: 'Open one item at a time.',
    },
  },
  slots: {
    default: {
      label: 'Items',
      content: 'blocks',
      accepts: ['block-accordion-item'],
    },
  },
})

const group = useId()

provide(
  'pluto-blocks-accordion',
  computed(() => (props.single ? group : undefined))
)
</script>

<template>
  <div class="pluto-blocks-accordion">
    <slot />
  </div>
</template>
