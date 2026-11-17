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

const AUTOCOMPLETE: Record<string, string> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
}

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <PlutoFormControl :id="props.id" :field="props.field" :error="props.error">
    <template #default="{ describedby, invalid }">
      <input
        :id="props.id"
        :type="props.field.type"
        :name="props.field.name"
        :value="props.modelValue ?? ''"
        :placeholder="props.field.placeholder"
        :autocomplete="AUTOCOMPLETE[props.field.type]"
        :inputmode="props.field.type === 'tel' ? 'tel' : undefined"
        :min="props.field.type === 'number' ? props.field.min : undefined"
        :max="props.field.type === 'number' ? props.field.max : undefined"
        :minlength="props.field.minLength"
        :maxlength="props.field.maxLength"
        :disabled="props.disabled"
        :aria-required="props.field.required ? 'true' : undefined"
        :aria-invalid="invalid ? 'true' : undefined"
        :aria-describedby="describedby"
        class="pluto-form__input"
        @input="onInput"
      />
    </template>
  </PlutoFormControl>
</template>
