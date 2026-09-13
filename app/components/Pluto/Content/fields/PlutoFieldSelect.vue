<script setup lang="ts">
const props = defineProps<{
  field: PlutoSelectField
  modelValue: unknown
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const items = computed(() =>
  props.field.options.map((option) => ({ label: option.label, value: option.value }))
)
const value = computed(() => props.modelValue as string | number | undefined)
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <USelect
      :model-value="value"
      :items="items"
      :disabled="disabled"
      class="w-full"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
