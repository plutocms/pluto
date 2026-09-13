<script setup lang="ts">
const props = defineProps<{
  field: PlutoNumberField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const value = computed(() => {
  const raw = props.modelValue
  return typeof raw === 'number' ? raw : null
})
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <UInputNumber
      :model-value="value"
      :min="field.min"
      :max="field.max"
      :step="field.integer ? 1 : undefined"
      :disabled="disabled"
      class="w-full"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
