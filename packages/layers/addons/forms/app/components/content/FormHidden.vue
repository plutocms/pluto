<script setup lang="ts">
interface Props {
  name?: string
  value?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: undefined,
  value: undefined,
})

definePlutoBlock<Props>({
  label: 'Hidden value',
  description: 'A value that the form sends with no field, such as the name of the campaign.',
  icon: 'i-lucide-eye-off',
  group: 'form',
  hidden: true,
  insert: '::form-hidden{name="source" value="website"}\n::',
  props: {
    name: {
      description: 'The key of the value.',
    },
    value: {
      description: 'The value that the form sends.',
    },
  },
})

const field = usePlutoFormBlockField('form-hidden', props)
</script>

<template>
  <p class="pluto-form__hidden-note">
    {{ field.name }}: {{ field.value }}
  </p>
</template>
