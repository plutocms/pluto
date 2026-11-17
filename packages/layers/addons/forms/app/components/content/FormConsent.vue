<script setup lang="ts">
interface Props {
  label?: string
  link?: string
  help?: string
  required?: boolean
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  link: undefined,
  help: undefined,
  required: true,
  name: undefined,
})

definePlutoBlock<Props>({
  label: 'Consent',
  description: 'A box that the visitor must tick to agree, with a link to the privacy policy.',
  icon: 'i-lucide-shield-check',
  group: 'form',
  hidden: true,
  insert: '::form-consent{label="I agree to the privacy policy" link="/privacy"}\n::',
  props: {
    label: {
      description: 'The text next to the box.',
    },
    link: {
      type: 'link',
      description: 'The page of the privacy policy.',
    },
    help: {
      description: 'A short note under the field.',
    },
    required: {
      type: 'boolean',
      description: 'The visitor must tick the box. On by default.',
    },
    name: {
      description: 'The key of the value. Empty: made from the label.',
      advanced: true,
    },
  },
})

const id = useId()

const field = usePlutoFormBlockField('form-consent', props)
</script>

<template>
  <PlutoFormConsent :id="id" :field="field" />
</template>
