<script setup lang="ts">
import type { ButtonProps, DropdownMenuItem } from '@nuxt/ui'

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
const canPublish = computed(() => {
  const cap = contentType.value?.capabilities?.publish ?? contentType.value?.capabilities?.write
  return !cap || can(cap)
})
const canDelete = computed(
  () => !contentType.value?.capabilities?.delete || can(contentType.value.capabilities.delete)
)

const editing = computed(() => props.id !== undefined)
const basePath = computed(() => contentType.value?.basePath ?? `/admin/content/${props.type}`)

// editPath exists so an already-deployed layer's edit URL never has to
// change to adopt this component — see the doc comment on
// PlutoContentType.editPath for why a single basePath cannot always
// express it.
function editPath(id: string | number) {
  return contentType.value?.editPath?.(id) ?? `${basePath.value}/${id}`
}

const { item, save, remove } = usePlutoContentItem(props.type, () => props.id)

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

// --- Status / publish workflow ----------------------------------------------

const statusConfig = computed(() => contentType.value?.status || null)
const publishedValue = computed(() => statusConfig.value?.publishedValue ?? 'published')
const draftValue = computed(
  () =>
    statusConfig.value?.default ??
    statusConfig.value?.values.find((value) => value.value !== publishedValue.value)?.value
)
const currentStatus = computed(
  () => (item.value.status as string | undefined) ?? statusConfig.value?.default
)
const isPublished = computed(
  () => statusConfig.value !== null && currentStatus.value === publishedValue.value
)
const statusLabel = computed(
  () => statusConfig.value?.values.find((value) => value.value === currentStatus.value)?.label ?? currentStatus.value
)

// --- Save -------------------------------------------------------------------

const toast = useToast()
const saving = ref(false)
const validationErrors = ref<ContentValidationError[]>([])

function buildPayload(statusOverride?: string): Record<string, unknown> {
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

  if (statusOverride !== undefined) {
    payload.status = statusOverride
  }

  return payload
}

async function onSave(statusOverride?: string) {
  const type = contentType.value
  if (!type) {
    return
  }

  const payload = buildPayload(statusOverride)
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
      await navigateTo(editPath(saved.id))
      return
    }

    const title =
      statusOverride === publishedValue.value
        ? 'Published'
        : statusOverride === draftValue.value
          ? 'Unpublished'
          : 'Saved'

    toast.add({
      title,
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

// --- Delete -------------------------------------------------------------------

const isDeleteModalOpen = ref(false)
const deleting = ref(false)

function openDeleteModal() {
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false
}

async function confirmDelete() {
  deleting.value = true

  try {
    await remove()
    closeDeleteModal()
    await navigateTo(basePath.value)
  } catch {
    toast.add({
      title: 'Error',
      description: 'An error occurred while removing.',
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

// --- Layout / aside -----------------------------------------------------------

const layout = computed(() => contentType.value?.form?.layout ?? 'default')
const showAside = computed(() => {
  const configured = contentType.value?.form?.aside
  if (configured === true || configured === false) {
    return configured
  }
  return sideFields.value.length > 0
})
const asideCollapsedByDefault = computed(
  () => contentType.value?.form?.asideCollapsed ?? layout.value === 'focus'
)
// Remember the open/closed state per content type across visits.
const asideOpen = useCookie<boolean>(`pluto-content-aside-${props.type}`, {
  default: () => !asideCollapsedByDefault.value,
})

function toggleAside() {
  asideOpen.value = !asideOpen.value
}

// --- Registry content actions --------------------------------------------------

const toolbarActions = usePlutoContentActions(props.type, 'toolbar')

// Only rendered from the template inside the `v-if="contentType"` branch, so
// `contentType.value` is always set by the time this is read.
function buildActionContext(): PlutoContentActionContext {
  return {
    type: contentType.value as PlutoContentType,
    item: item.value,
    editing: editing.value,
    saving: saving.value,
    save: () => onSave(),
    remove: () => confirmDelete(),
  }
}

const unpublishDeleteItems = computed<DropdownMenuItem[][]>(() => [
  [
    ...(statusConfig.value && isPublished.value && canPublish.value
      ? [
          {
            label: 'Unpublish',
            icon: 'lucide:eye-off',
            onSelect: () => onSave(draftValue.value),
          },
        ]
      : []),
    ...(editing.value && canDelete.value
      ? [
          {
            label: 'Delete',
            icon: 'lucide:trash',
            color: 'error' as const,
            onSelect: () => openDeleteModal(),
          },
        ]
      : []),
  ],
])
</script>

<template>
  <PlutoAdminPanel v-if="contentType" :width="layout === 'focus' ? 'full' : 'container'">
    <template #toolbar>
      <PlutoViewToolbar
        :back-to="basePath"
        :title="layout === 'focus' ? (editing ? `Edit ${contentType.label}` : `New ${contentType.label}`) : undefined"
      >
        <template #right>
          <UBadge v-if="statusConfig" :color="isPublished ? 'success' : 'neutral'" variant="subtle">
            {{ statusLabel }}
          </UBadge>

          <template v-for="action in toolbarActions" :key="action.id">
            <UButton
              v-if="action.show?.(buildActionContext()) !== false"
              :icon="action.icon"
              :color="(action.color as ButtonProps['color'])"
              :variant="(action.variant as ButtonProps['variant'])"
              @click="action.onSelect(buildActionContext())"
            >
              {{ action.label }}
            </UButton>
          </template>

          <UButton
            v-if="canWrite && (!statusConfig || !isPublished)"
            :loading="saving"
            icon="lucide:save"
            variant="subtle"
            @click="onSave()"
          >
            Save{{ statusConfig ? ' draft' : '' }}
          </UButton>

          <UButton
            v-if="canWrite && statusConfig && isPublished"
            :loading="saving"
            icon="lucide:save"
            @click="onSave()"
          >
            Update
          </UButton>

          <UButton
            v-if="canPublish && statusConfig && !isPublished"
            :loading="saving"
            icon="lucide:upload"
            @click="onSave(publishedValue)"
          >
            Publish
          </UButton>

          <UDropdownMenu
            v-if="(editing && canDelete) || (statusConfig && isPublished && canPublish)"
            :items="unpublishDeleteItems"
          >
            <UButton icon="lucide:ellipsis-vertical" color="neutral" variant="ghost" square />
          </UDropdownMenu>

          <UButton
            v-if="showAside"
            :icon="asideOpen ? 'lucide:panel-right-close' : 'lucide:panel-right-open'"
            color="neutral"
            variant="ghost"
            square
            @click="toggleAside"
          />
        </template>
      </PlutoViewToolbar>
    </template>

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

    <h1 v-if="layout !== 'focus'" class="text-3xl font-bold lg:text-4xl">
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

    <template v-if="showAside" #aside>
      <PlutoViewAside v-model:open="asideOpen" title="Settings">
        <div class="flex flex-col gap-6">
          <PlutoContentField
            v-for="field in sideFields"
            :key="field.name"
            :field="field"
            :model-value="item[field.name]"
            :disabled="!canWrite || saving"
            @update:model-value="updateField(field, $event)"
          />
        </div>
      </PlutoViewAside>
    </template>
  </PlutoAdminPanel>

  <PlutoAdminPanel v-else>
    <UAlert
      :description="`No content type named &quot;${type}&quot; is registered.`"
      color="error"
      title="Content type not found"
    />
  </PlutoAdminPanel>

  <Modal v-model="isDeleteModalOpen" :custom-size="480">
    <ModalHeader @close="closeDeleteModal">Remove {{ contentType?.label }}</ModalHeader>

    <ModalContent>
      <p>Do you really want to remove this item?</p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton icon="lucide:x" variant="ghost" color="neutral" @click="closeDeleteModal">
          Cancel
        </UButton>

        <UButton :loading="deleting" icon="lucide:trash" color="error" @click="confirmDelete">
          Remove
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
