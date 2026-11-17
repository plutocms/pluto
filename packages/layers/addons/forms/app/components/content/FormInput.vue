<script setup lang="ts">
interface Props {
  label?: string
  type?: 'text' | 'email' | 'tel' | 'url' | 'number' | 'date'
  placeholder?: string
  help?: string
  required?: boolean
  width?: 'full' | 'half'
  name?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  type: 'text',
  placeholder: undefined,
  help: undefined,
  width: undefined,
  name: undefined,
  minLength: undefined,
  maxLength: undefined,
  min: undefined,
  max: undefined,
  pattern: undefined,
})

definePlutoBlock<Props>({
  label: 'Input',
  description: 'One line field: text, email, phone, URL, number or date.',
  icon: 'i-lucide-text-cursor-input',
  group: 'form',
  hidden: true,
  insert: '::form-input{label="Name" required}\n::',
  props: {
    label: {
      description: 'The text above the field.',
    },
    type: {
      type: 'select',
      options: ['text', 'email', 'tel', 'url', 'number', 'date'],
      description: 'The kind of value.',
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
    min: {
      type: 'number',
      description: 'For a number: the least value.',
      advanced: true,
    },
    max: {
      type: 'number',
      description: 'For a number: the most value.',
      advanced: true,
    },
    pattern: {
      description: 'A regular expression that the whole value must match.',
      advanced: true,
    },
  },
})

const id = useId()

const field = usePlutoFormBlockField('form-input', props)
</script>

<template>
  <PlutoFormInput :id="id" :field="field" />
</template>
