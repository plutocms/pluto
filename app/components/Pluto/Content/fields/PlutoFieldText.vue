<script setup lang="ts">
// Renders both 'text' and 'textarea' fields. `richtext` has no core widget
// — a layer (for example @plutocms/supabase-blog) registers its own.
const props = defineProps<{
  field: PlutoTextField
  modelValue: unknown
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

const isTextarea = computed(() => props.field.type === 'textarea')
const value = computed(() => (props.modelValue as string | undefined) ?? undefined)
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <UTextarea
      v-if="isTextarea"
      :model-value="value"
      :placeholder="field.placeholder"
      :maxlength="field.maxLength"
      :disabled="disabled"
      class="w-full"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <UInput
      v-else
      :model-value="value"
      :placeholder="field.placeholder"
      :maxlength="field.maxLength"
      :disabled="disabled"
      class="w-full"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </UFormField>
</template>
