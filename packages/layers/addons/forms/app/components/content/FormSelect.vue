<script setup lang="ts">
interface Props {
  label?: string
  options?: string
  placeholder?: string
  help?: string
  required?: boolean
  width?: 'full' | 'half'
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  options: undefined,
  placeholder: undefined,
  help: undefined,
  width: undefined,
  name: undefined,
})

definePlutoBlock<Props>({
  label: 'Select',
  description: 'A drop-down list. The visitor picks one option.',
  icon: 'i-lucide-chevrons-up-down',
  group: 'form',
  hidden: true,
  insert: '::form-select{label="Subject" options="Sales; Support; Other"}\n::',
  props: {
    label: {
      description: 'The text above the field.',
    },
    options: {
      type: 'text',
      description: 'The options, separated by semicolons. Write value|Label to give a value that is not the label.',
    },
    placeholder: {
      description: 'The text of the empty choice.',
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

const field = usePlutoFormBlockField('form-select', props)
</script>

<template>
  <PlutoFormSelect :id="id" :field="field" />
</template>
