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

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <PlutoFormControl :id="props.id" :field="props.field" :error="props.error">
    <template #default="{ describedby, invalid }">
      <textarea
        :id="props.id"
        :name="props.field.name"
        :value="props.modelValue ?? ''"
        :rows="props.field.rows ?? 5"
        :placeholder="props.field.placeholder"
        :minlength="props.field.minLength"
        :maxlength="props.field.maxLength"
        :disabled="props.disabled"
        :aria-required="props.field.required ? 'true' : undefined"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="describedby"
        class="pluto-form__input pluto-form__textarea"
        @input="onInput"
      />
    </template>
  </PlutoFormControl>
</template>
