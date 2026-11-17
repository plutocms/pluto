<script setup lang="ts">
interface Props {
  label?: string
  placeholder?: string
  help?: string
  required?: boolean
  width?: 'full' | 'half'
  name?: string
  rows?: number
  minLength?: number
  maxLength?: number
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  placeholder: undefined,
  help: undefined,
  width: undefined,
  name: undefined,
  rows: undefined,
  minLength: undefined,
  maxLength: undefined,
})

definePlutoBlock<Props>({
  label: 'Text area',
  description: 'A field for a long text, such as a message.',
  icon: 'i-lucide-align-left',
  group: 'form',
  hidden: true,
  insert: '::form-textarea{label="Message" required}\n::',
  props: {
    label: {
      description: 'The text above the field.',
    },
    placeholder: {
      description: 'A hint inside the empty field.',
    },
    help: {
      description: 'A short note under the field.',
    },
    required: {
      type: 'boolean',
      description: 'The visitor must fill the field.',
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
    rows: {
      type: 'number',
      description: 'The height in lines.',
      advanced: true,
    },
    minLength: {
      type: 'number',
      description: 'The least number of characters.',
      advanced: true,
    },
    maxLength: {
      type: 'number',
      description: 'The most characters.',
      advanced: true,
    },
  },
})

const id = useId()

const field = usePlutoFormBlockField('form-textarea', props)
</script>

<template>
  <PlutoFormTextarea :id="id" :field="field" />
</template>
