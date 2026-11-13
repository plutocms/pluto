<script setup lang="ts">
const props = defineProps<{
  label: string
  field?: PlutoField
  items?: Array<{ label: string; value: string }>
}>()

const model = defineModel<string | undefined>()
const { t } = usePlutoI18n()

const ALL = '__pluto_all__'

const reference =
  props.field && isTargetReference(props.field)
    ? usePlutoReferenceOptions(props.field.target)
    : null

onMounted(() => {
  reference?.ensure().catch(() => {})
})

const choices = computed<Array<{ label: string; value: string }>>(() => {
  const field = props.field
  if (!field) {
    return props.items ?? []
  }
  if (field.type === 'boolean') {
    return [
      { label: t('pluto.list.yes'), value: 'true' },
      { label: t('pluto.list.no'), value: 'false' },
    ]
  }
  if (field.type === 'select') {
    return field.options.map((option) => ({
      label: option.label,
      value: String(option.value),
    }))
  }
  return (reference?.options.value ?? []).map((option) => ({
    label: option.label,
    value: String(option.value),
  }))
})

const chosenLabel = computed(
  () =>
    choices.value.find((choice) => choice.value === model.value)?.label ??
    model.value
)

const menuItems = computed(() => [
  { label: t('pluto.list.filterAll'), value: ALL },
  ...choices.value,
])

const selected = computed({
  get: () => model.value,
  set: (value: string | undefined) => {
    model.value = value === ALL || value === undefined ? undefined : value
  },
})
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="menuItems"
    :placeholder="label"
    :aria-label="t('pluto.list.filterBy', { label })"
    :search-input="
      reference ? { placeholder: t('pluto.list.filterSearch') } : false
    "
    :loading="reference?.pending.value"
    :highlight="model !== undefined"
    color="primary"
    value-key="value"
    class="w-48"
  >
    <template v-if="model !== undefined" #default>
      <span class="truncate">
        <span class="text-muted">{{ label }}:</span>
        {{ chosenLabel }}
      </span>
    </template>
  </USelectMenu>
</template>
