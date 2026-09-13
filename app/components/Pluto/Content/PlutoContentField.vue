<script setup lang="ts">
// Dispatches to whichever widget is registered for `field`, and re-emits
// `update:modelValue` unchanged. Never needs to know which concrete widget
// it dispatched to — every widget shares the same field/modelValue/disabled
// contract (see the content-model skill).
const props = defineProps<{
  field: PlutoField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const widget = usePlutoContentFieldWidget(props.field)
</script>

<template>
  <component
    :is="widget"
    v-if="widget"
    :field="field"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <UFormField v-else :label="field.label">
    <p class="text-muted text-sm">
      No widget registered for field type "{{ field.type }}".
    </p>
  </UFormField>
</template>
