<script setup lang="ts">
// A plain text input plus a preview line. This widget does not auto-derive
// the slug from another field — only `PlutoContentForm` knows about the
// *other* field (`field.from`) a slug derives from, so that logic lives
// there, not here. See the content-model skill for the slug bug this
// separation is meant to avoid repeating.
const props = defineProps<{
  field: PlutoSlugField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const value = computed(() => (props.modelValue as string | undefined) ?? '')
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <UInput
      :model-value="value"
      :disabled="disabled"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <p v-if="field.preview" class="text-muted mt-1 text-sm">
      {{ field.preview }}{{ value }}
    </p>
  </UFormField>
</template>
