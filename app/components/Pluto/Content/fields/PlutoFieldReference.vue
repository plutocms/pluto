<script setup lang="ts">
// Only `field.optionsUrl` is resolved in this wave. `field.target` (a
// same-app content-type reference with no `optionsUrl`) needs the generic
// list endpoint of *another* content type, which is out of scope here — see
// the content-model skill.
const props = defineProps<{
  field: PlutoReferenceField
  modelValue: unknown
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

interface ReferenceOption {
  label: string
  value: string | number
}

interface ReferenceOptionsResponse {
  data: Array<Record<string, unknown>>
}

const options = ref<ReferenceOption[]>([])
const pending = ref(false)

async function loadOptions() {
  if (!props.field.optionsUrl) {
    return
  }

  pending.value = true

  try {
    const result = await $fetch<ReferenceOptionsResponse>(props.field.optionsUrl)
    const labelKey = props.field.labelKey ?? 'label'
    const valueKey = props.field.valueKey ?? 'id'

    options.value = result.data.map((row) => ({
      label: String(row[labelKey] ?? ''),
      value: row[valueKey] as string | number,
    }))
  } finally {
    pending.value = false
  }
}

onMounted(loadOptions)

const hasOptionsSource = computed(() => Boolean(props.field.optionsUrl))
const value = computed(() => props.modelValue as string | number | undefined)
</script>

<template>
  <UFormField :label="field.label" :description="field.description" :required="field.required">
    <UInputMenu
      v-if="hasOptionsSource"
      :model-value="value"
      :items="options"
      :loading="pending"
      :disabled="disabled"
      value-key="value"
      label-key="label"
      class="w-full"
      @update:model-value="$emit('update:modelValue', $event)"
    />

    <UInputMenu
      v-else
      :items="[]"
      value-key="value"
      label-key="label"
      placeholder="No options source configured for this reference field."
      class="w-full"
      disabled
    />
  </UFormField>
</template>
