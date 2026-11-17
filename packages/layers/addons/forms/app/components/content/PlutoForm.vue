<script setup lang="ts">
import PlutoFormDefault from '../PlutoForm.vue'

interface Props {
  form: string
}

const props = defineProps<Props>()

definePlutoBlock<Props>({
  label: 'Form',
  description: 'A form of the site, by its handle. Make the forms in the Forms section.',
  icon: 'i-lucide-text-cursor-input',
  group: 'form',
  insert: '::pluto-form{form="contact"}\n::',
  props: {
    form: {
      description: 'The handle of the form, for example contact.',
    },
  },
})
</script>

<template>
  <PlutoFormDefault v-if="props.form" :handle="props.form" />
</template>
