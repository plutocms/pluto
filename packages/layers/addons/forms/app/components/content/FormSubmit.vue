<script setup lang="ts">
interface Props {
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
})

definePlutoBlock<Props>({
  label: 'Submit button',
  description: 'The button that sends the form. Its label is the text of the button.',
  icon: 'i-lucide-send',
  group: 'form',
  hidden: true,
  insert: '::form-submit{label="Send"}\n::',
  props: {
    label: {
      description: 'The text of the button.',
    },
  },
})
</script>

<template>
  <PlutoFormSubmit :label="props.label || 'Send'" />
</template>
