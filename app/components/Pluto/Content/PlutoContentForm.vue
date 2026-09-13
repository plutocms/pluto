<script setup lang="ts">
const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
  /** Present in edit mode. Absent in "new entry" mode. */
  id?: string | number
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))

if (!contentType.value) {
  // The generated page (`app/pages/admin/content/[type]/{new,[id]}.vue`)
  // already resolves the type and 404s before this component ever mounts,
  // so this should not normally happen.
  console.error(`PlutoContentForm: content type "${props.type}" was not found in the registry.`)
}

const { can } = usePlutoPermissions()

// "No capability declared" means the operation is open to anyone who can
// reach this page — never call can('') as a stand-in for that.
const canWrite = computed(
  () => !contentType.value?.capabilities?.write || can(contentType.value.capabilities.write)
)

const editing = computed(() => props.id !== undefined)
const basePath = computed(() => contentType.value?.basePath ?? `/admin/content/${props.type}`)

const { item, save } = usePlutoContentItem(props.type, () => props.id)

function sortedFields(region: 'main' | 'side') {
  return computed(() =>
    (contentType.value?.fields ?? [])
      .filter((field) => field.inForm !== false && (field.region ?? 'main') === region)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  )
}

const mainFields = sortedFields('main')
const sideFields = sortedFields('side')

// --- Slug auto-derivation, with the PostForm.vue bug fixed -----------------
//
// PostForm.vue re-derives its slug from the title on every keystroke, with
// no gate at all — including while editing an already-published,
// already-shared post, silently changing a live URL. Auto-derivation here
// stops the moment either:
//
// 1. The form is in edit mode (`editing` is true) — an existing entry's
//    slug is presumed already meaningful, and never auto-changes without
//    the user directly touching the slug field.
// 2. The user has typed into the slug field directly, even while creating
//    a new entry — tracked by `slugTouched`, flipped by `updateField` below
//    the moment a 'slug' field's own `update:modelValue` fires.
const slugTouched = ref(false)
const slugField = computed(() =>
  contentType.value?.fields.find((field): field is PlutoSlugField => field.type === 'slug')
)

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

watch(
  () => {
    const from = slugField.value?.from
    return from ? item.value[from] : undefined
  },
  (value) => {
    if (!slugField.value || editing.value || slugTouched.value) {
      return
    }

    item.value[slugField.value.name] = slugify(String(value ?? ''))
  }
)

function updateField(field: PlutoField, value: unknown) {
  if (field.type === 'slug') {
    slugTouched.value = true
  }

  item.value[field.name] = value
}

// --- Save -------------------------------------------------------------------

const toast = useToast()
const saving = ref(false)
const validationErrors = ref<ContentValidationError[]>([])

function buildPayload(): Record<string, unknown> {
  const type = contentType.value
  if (!type) {
    return {}
  }

  const payload: Record<string, unknown> = {}
  for (const field of type.fields) {
    if (Object.hasOwn(item.value, field.name)) {
      payload[field.name] = item.value[field.name]
    }
  }

  return payload
}

async function onSave() {
  const type = contentType.value
  if (!type) {
    return
  }

  const payload = buildPayload()
  const errors = validateContentPayload(type, payload, { partial: editing.value })

  if (errors.length > 0) {
    validationErrors.value = errors
    return
  }

  validationErrors.value = []
  saving.value = true

  try {
    const saved = await save(payload)

    if (!editing.value) {
      await navigateTo(`${basePath.value}/${saved.id}`)
      return
    }

    toast.add({
      title: 'Saved',
      description: `${type.label} updated successfully.`,
      color: 'success',
    })
  } catch {
    // A raced permissions check, or any other server-side rejection
    // (a 403 included), surfaces here rather than as an unhandled
    // rejection.
    toast.add({
      title: 'Error',
      description: 'An error occurred while saving.',
      color: 'error',
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="contentType">
    <AdminView>
      <UAlert
        v-if="validationErrors.length > 0"
        color="error"
        title="Please fix the following before saving"
      >
        <template #description>
          <ul class="list-disc pl-4">
            <li v-for="fieldError in validationErrors" :key="fieldError.field">
              {{ fieldError.message }}
            </li>
          </ul>
        </template>
      </UAlert>

      <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div class="flex flex-1 flex-col gap-6">
          <h1 class="text-3xl font-bold lg:text-4xl">
            {{ editing ? `Edit ${contentType.label}` : `New ${contentType.label}` }}
          </h1>

          <PlutoContentField
            v-for="field in mainFields"
            :key="field.name"
            :field="field"
            :model-value="item[field.name]"
            :disabled="!canWrite || saving"
            @update:model-value="updateField(field, $event)"
          />
        </div>

        <div class="flex w-full shrink-0 flex-col gap-6 lg:max-w-xs">
          <UButton
            v-if="canWrite"
            :loading="saving"
            icon="lucide:save"
            class="justify-center"
            @click="onSave"
          >
            Save
          </UButton>

          <PlutoContentField
            v-for="field in sideFields"
            :key="field.name"
            :field="field"
            :model-value="item[field.name]"
            :disabled="!canWrite || saving"
            @update:model-value="updateField(field, $event)"
          />
        </div>
      </div>
    </AdminView>
  </div>

  <AdminView v-else>
    <UAlert
      :description="`No content type named &quot;${type}&quot; is registered.`"
      color="error"
      title="Content type not found"
    />
  </AdminView>
</template>
