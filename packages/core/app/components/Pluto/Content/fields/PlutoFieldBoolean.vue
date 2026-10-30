<script setup lang="ts">
const props = defineProps<{
  field: PlutoBooleanField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const value = computed(() => props.modelValue === true)
</script>

<template>
  <UFormField :label="field.label" :description="field.description">
    <USwitch
      :model-value="value"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
