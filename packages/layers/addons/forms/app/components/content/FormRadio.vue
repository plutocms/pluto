<script setup lang="ts">
interface Props {
  label?: string
  options?: string
  help?: string
  required?: boolean
  width?: 'full' | 'half'
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  options: undefined,
  help: undefined,
  width: undefined,
  name: undefined,
})

definePlutoBlock<Props>({
  label: 'Radio buttons',
  description: 'A short list of options, all in view. The visitor picks one.',
  icon: 'i-lucide-circle-dot',
  group: 'form',
  hidden: true,
  insert: '::form-radio{label="Plan" options="Basic; Pro"}\n::',
  props: {
    label: {
      description: 'The text above the options.',
    },
    options: {
      type: 'text',
      description: 'The options, separated by semicolons. Write value|Label to give a value that is not the label.',
    },
    help: {
      description: 'A short note under the field.',
    },
    required: {
      type: 'boolean',
      description: 'The visitor must choose one.',
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

const field = usePlutoFormBlockField('form-radio', props)
</script>

<template>
  <PlutoFormRadio :id="id" :field="field" />
</template>
