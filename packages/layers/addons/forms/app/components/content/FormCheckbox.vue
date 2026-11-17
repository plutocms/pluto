<script setup lang="ts">
interface Props {
  label?: string
  help?: string
  required?: boolean
  width?: 'full' | 'half'
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  help: undefined,
  width: undefined,
  name: undefined,
})

definePlutoBlock<Props>({
  label: 'Checkbox',
  description: 'A box that the visitor ticks, for a yes or no.',
  icon: 'i-lucide-square-check',
  group: 'form',
  hidden: true,
  insert: '::form-checkbox{label="Send me the newsletter"}\n::',
  props: {
    label: {
      description: 'The text next to the box.',
    },
    help: {
      description: 'A short note under the field.',
    },
    required: {
      type: 'boolean',
      description: 'The visitor must tick the box.',
    },
    width: {
      type: 'select',
      options: ['full', 'half'],
      description: 'Half puts two fields in one row.',
    },
    name: {
      description: 'The key of the value. Empty: made from the label.',
      advanced: true,
    },
  },
})

const id = useId()

const field = usePlutoFormBlockField('form-checkbox', props)
</script>

<template>
  <PlutoFormCheckbox :id="id" :field="field" />
</template>
