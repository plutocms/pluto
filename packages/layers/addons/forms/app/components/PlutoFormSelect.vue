<script setup lang="ts">
import type { PlutoFormField } from '../../shared/types/forms'

interface Props {
  field: PlutoFormField
  id: string
  modelValue?: string
  error?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  error: undefined,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <PlutoFormControl :id="props.id" :field="props.field" :error="props.error">
    <template #default="{ describedby, invalid }">
      <select
        :id="props.id"
        :name="props.field.name"
        :value="props.modelValue ?? ''"
        :disabled="props.disabled"
        :aria-required="props.field.required ? 'true' : undefined"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="describedby"
        class="pluto-form__input pluto-form__select"
        @change="onChange"
      >
        <option value="">
          {{ props.field.placeholder || '' }}
        </option>

        <option
          v-for="option in props.field.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </template>
  </PlutoFormControl>
</template>
