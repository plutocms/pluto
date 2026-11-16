<script setup lang="ts">
interface Props {
  title?: string
  open?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  open: false,
})

definePlutoBlock<Props>({
  label: 'Accordion item',
  description: 'One question of an accordion, with its answer.',
  icon: 'i-lucide-chevron-down',
  group: 'landing',
  props: {
    title: {
      type: 'string',
      description: 'The question. It is the button that opens the answer.',
    },
    open: {
      description: 'Show the answer when the page loads.',
    },
  },
  slots: {
    default: {
      label: 'Answer',
      content: 'rich',
    },
  },
})

const group = inject<Ref<string | undefined> | undefined>(
  'pluto-blocks-accordion',
  undefined
)

const name = computed(() => group?.value)
</script>

<template>
  <details
    :name="name"
    :open="props.open || undefined"
    class="pluto-blocks-accordion-item"
  >
    <summary class="pluto-blocks-accordion-item__title">
      {{ props.title }}
    </summary>

    <div class="pluto-blocks-accordion-item__content">
      <slot />
    </div>
  </details>
</template>
