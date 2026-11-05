<script setup lang="ts">
import type {PlutoReferenceOption} from '../../../../composables/internal/reference-options';
// The core `reference` widget. The value is one id, or a list of ids in order (`multiple`).
// The choices come from one of two sources:
// - `field.target`: the items of another content type, from the generic admin route (see
//   `usePlutoReferenceOptions`). With `field.create` and the write capability of the target,
//   the menu offers to create a new item from the typed text.
// - `field.optionsUrl`: a URL that answers `{ data: [...] }`.
// An id with no option (a deleted item) shows its text, so the value is not lost. See the
// tags-and-categories skill.
import {
  
  withUnknownIds
} from '../../../../composables/internal/reference-options'

const props = defineProps<{
  field: PlutoReferenceField
  modelValue: unknown
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number | Array<string | number> | null]
}>()

interface ReferenceOptionsResponse {
  data: Array<Record<string, unknown>>
}

const { t } = usePlutoI18n()
const { can } = usePlutoPermissions()
const { byName } = usePlutoContentTypes()
const toast = useToast()
const errorText = usePlutoErrorText()

const target = computed(() => props.field.target ?? '')
const targetOptions = usePlutoReferenceOptions(target)

// The `optionsUrl` source.
const urlOptions = ref<PlutoReferenceOption[]>([])
const urlPending = ref(false)

async function loadUrlOptions() {
  if (!props.field.optionsUrl) {
    return
  }
  urlPending.value = true
  try {
    const result = await $fetch<ReferenceOptionsResponse>(
      props.field.optionsUrl
    )
    const labelKey = props.field.labelKey ?? 'label'
    const valueKey = props.field.valueKey ?? 'id'
    urlOptions.value = result.data.map((row) => ({
      label: String(row[labelKey] ?? ''),
      value: row[valueKey] as string | number,
    }))
  } finally {
    urlPending.value = false
  }
}

const usesTarget = computed(() => Boolean(props.field.target))
const hasOptionsSource = computed(
  () => usesTarget.value || Boolean(props.field.optionsUrl)
)

onMounted(() => {
  if (usesTarget.value) {
    targetOptions.ensure().catch(() => {})
  } else {
    loadUrlOptions().catch(() => {})
  }
})

const ids = computed(() => referenceValue(props.modelValue))
const baseOptions = computed(() =>
  usesTarget.value ? targetOptions.options.value : urlOptions.value
)
const items = computed(() => withUnknownIds(baseOptions.value, ids.value))
const pending = computed(() =>
  usesTarget.value ? targetOptions.pending.value : urlPending.value
)

// The model of the menu: a list for `multiple`, else one id (or nothing).
const menuValue = computed(() =>
  props.field.multiple ? ids.value : ids.value[0]
)

function emitIds(next: Array<string | number>) {
  emit(
    'update:modelValue',
    props.field.multiple ? next : (next[0] ?? null)
  )
}

function onUpdate(value: unknown) {
  emitIds(referenceValue(value))
}

// The inline create needs the option on the field and the write capability of the target.
const canCreate = computed(() => {
  if (!props.field.create || !usesTarget.value) {
    return false
  }
  const type = byName(target.value)
  const capability = type?.capabilities?.write
  return Boolean(type) && (!capability || can(capability))
})

const creating = ref(false)

async function onCreate(text: string) {
  const title = text.trim()
  if (title === '' || creating.value) {
    return
  }
  creating.value = true
  try {
    const option = await targetOptions.create(title)
    const next = props.field.multiple ? ids.value : []
    if (!next.some((id) => String(id) === String(option.value))) {
      next.push(option.value)
    }
    emitIds([...next])
  } catch (error) {
    toast.add({
      title: t('pluto.common.error'),
      description: errorText(error, 'pluto.fields.reference.createFailed'),
      color: 'error',
    })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <UFormField
    :label="field.label"
    :description="field.description"
    :required="field.required"
  >
    <UInputMenu
      v-if="hasOptionsSource"
      :model-value="menuValue"
      :items="items"
      :loading="pending || creating"
      :disabled="disabled"
      :multiple="field.multiple"
      :create-item="canCreate ? 'always' : false"
      :placeholder="t('pluto.fields.reference.placeholder')"
      value-key="value"
      label-key="label"
      class="w-full"
      @update:model-value="onUpdate"
      @create="onCreate"
    >
      <template #empty>
        {{ t('pluto.fields.reference.empty') }}
      </template>

      <template #create-item-label="{ item }">
        {{ t('pluto.fields.reference.create', { name: item }) }}
      </template>
    </UInputMenu>

    <UInputMenu
      v-else
      :items="[]"
      :placeholder="t('pluto.fields.noOptionsSource')"
      value-key="value"
      label-key="label"
      class="w-full"
      disabled
    />
  </UFormField>
</template>
