<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import { buildContentPayload } from '../../../composables/internal/content-payload'

const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
  /** Present in edit mode. Absent in "new entry" mode. */
  id?: string | number
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))
const { t } = usePlutoI18n()
const text = usePlutoContentText(contentType)
const errorText = usePlutoErrorText()

if (!contentType.value) {
  // The generated page (`app/pages/admin/content/[type]/{new,[id]}.vue`)
  // already resolves the type and 404s before this component ever mounts,
  // so this should not normally happen.
  console.error(
    `PlutoContentForm: content type "${props.type}" was not found in the registry.`
  )
}

const { can } = usePlutoPermissions()

// "No capability declared" means the operation is open to anyone who can
// reach this page — never call can('') as a stand-in for that.
const canWrite = computed(
  () =>
    !contentType.value?.capabilities?.write ||
    can(contentType.value.capabilities.write)
)
const canPublish = computed(() => {
  const cap =
    contentType.value?.capabilities?.publish ??
    contentType.value?.capabilities?.write
  return !cap || can(cap)
})
const canDelete = computed(
  () =>
    !contentType.value?.capabilities?.delete ||
    can(contentType.value.capabilities.delete)
)

const editing = computed(() => props.id !== undefined)
const basePath = computed(
  () => contentType.value?.basePath ?? `/admin/content/${props.type}`
)

// editPath exists so an already-deployed layer's edit URL never has to
// change to adopt this component — see the doc comment on
// PlutoContentType.editPath for why a single basePath cannot always
// express it.
function editPath(id: string | number) {
  return contentType.value?.editPath?.(id) ?? `${basePath.value}/${contentIdPath(id)}`
}

const { item, pending: itemPending, loadError, refresh, save, remove } = usePlutoContentItem(props.type, () => props.id)

// The item did not load (a 404, or a network error). The form shows an error
// state with a retry button. It shows no fields and no Save button.
const loadFailed = computed(() => editing.value && !itemPending.value && loadError.value !== null)
const loadNotFound = computed(() => {
  const error = loadError.value as {
 statusCode?: number
status?: number
} | null
  return (error?.statusCode ?? error?.status) === 404
})

// Save and publish stay off while the item is missing.
const canSave = computed(() => canWrite.value && !loadFailed.value)
const canPublishNow = computed(() => canPublish.value && !loadFailed.value)

function retryLoad() {
  refresh().catch(() => {})
}

// A missing item will not come back with a retry, so a 404 has no button.
const loadFailedActions = computed<ButtonProps[]>(() =>
  loadNotFound.value
    ? []
    : [{ label: t('pluto.common.tryAgain'), icon: 'lucide:refresh-ccw', color: 'neutral', variant: 'outline', onClick: retryLoad }]
)

function sortedFields(region: 'main' | 'side') {
  return computed(() =>
    (contentType.value?.fields ?? [])
      .filter(
        (field) => field.inForm !== false && (field.region ?? 'main') === region
      )
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
  contentType.value?.fields.find(
    (field): field is PlutoSlugField => field.type === 'slug'
  )
)

watch(
  () => {
    const from = slugField.value?.from
    return from ? item.value[from] : undefined
  },
  (value) => {
    if (!slugField.value || editing.value || slugTouched.value) {
      return
    }

    item.value[slugField.value.name] = slugifyTitle(String(value ?? ''))
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
const publishedValue = computed(
  () => statusConfig.value?.publishedValue ?? 'published'
)
const draftValue = computed(
  () =>
    statusConfig.value?.default ??
    statusConfig.value?.values.find(
      (value) => value.value !== publishedValue.value
    )?.value
)
const currentStatus = computed(
  () => (item.value.status as string | undefined) ?? statusConfig.value?.default
)
const isPublished = computed(
  () =>
    statusConfig.value !== null && currentStatus.value === publishedValue.value
)
const statusLabel = computed(() => {
  const value = currentStatus.value
  if (value === undefined) {
    return undefined
  }
  const literal = statusConfig.value?.values.find(
    (entry) => entry.value === value
  )?.label
  return text.statusLabel(value, literal)
})

// --- Save -------------------------------------------------------------------

const toast = useToast()
const saving = ref(false)
const validationErrors = ref<ContentValidationError[]>([])

// A validation error with a `code` shows the translated message. The
// `message` of the error stays English, and shows when there is no code.
function validationText(error: ContentValidationError): string {
  if (!error.code) {
    return error.message
  }
  const field = contentType.value?.fields.find((entry) => entry.name === error.field)
  return t(`pluto.validation.${error.code}`, {
    ...error.params,
    label: field ? text.fieldLabel(field) : error.field,
  })
}

async function onSave(statusOverride?: string) {
  const type = contentType.value
  if (!type) {
    return
  }

  const payload = buildContentPayload(type, item.value, statusOverride)
  const errors = validateContentPayload(type, payload, {
    partial: editing.value,
  })

  if (errors.length > 0) {
    validationErrors.value = errors
    return
  }

  validationErrors.value = []
  saving.value = true

  try {
    const saved = await save(payload)

    if (!editing.value) {
      toast.add({
        title: t('pluto.form.created'),
        description: t('pluto.form.createdDescription', { label: text.label }),
        color: 'success',
      })
      await navigateTo(editPath(saved.id))
      return
    }

    const title =
      statusOverride === publishedValue.value
        ? t('pluto.form.published')
        : statusOverride === draftValue.value
          ? t('pluto.form.unpublished')
          : t('pluto.form.saved')

    toast.add({
      title,
      description: t('pluto.form.updated', { label: text.label }),
      color: 'success',
    })

    // An adapter can change the id on save, for example a file-based adapter
    // that renames the file when the slug changes. Follow the new id. The
    // page mounts again for the new route, so the item loads under the new id.
    if (String(saved.id) !== String(props.id)) {
      await navigateTo(editPath(saved.id), { replace: true })
    }
  } catch (error) {
    // A raced permissions check, or any other server-side rejection
    // (a 403 included), surfaces here rather than as an unhandled
    // rejection.
    toast.add({
      title: t('pluto.common.error'),
      description: errorText(error, 'pluto.form.saveError'),
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
  } catch (error) {
    toast.add({
      title: t('pluto.common.error'),
      description: errorText(error, 'pluto.form.removeError'),
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

// --- Layout / aside -----------------------------------------------------------

// In edit mode, the heading and the tab title show the title of the item.
// While the item loads, or when it has no title, they show "Edit <type>".
const itemTitle = computed(() => {
  const value = editing.value ? item.value[contentType.value?.titleField ?? ''] : undefined
  return typeof value === 'string' ? value.trim() : ''
})
const heading = computed(() =>
  editing.value
    ? itemTitle.value || t('pluto.content.edit', { label: text.label })
    : text.newLabel
)

useHead({ title: () => heading.value })

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

// Below the `lg` breakpoint (64rem), the default layout shows the aside
// fields inline, in a titled section under the main fields. It renders no
// slideover there: a required field, such as a price, must not hide behind
// a button. The focus layout keeps the slideover.
const isDesktop = useMediaQuery('(min-width: 64rem)')
const inlineAside = computed(() => showAside.value && layout.value === 'default' && !isDesktop.value)
// The aside toggle has no use when the aside is inline, or when the item did not load.
const showAsideToggle = computed(() => showAside.value && !inlineAside.value && !loadFailed.value)

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

// No explicit `DropdownMenuItem` annotation. A consumer that links this
// layer from source can resolve a second copy of `@nuxt/ui`. A named type
// from one copy then fails to match the component from the other copy. An
// inferred, structural type matches both.
const unpublishDeleteItems = computed(() => [
  [
    ...(statusConfig.value && isPublished.value && canPublish.value
      ? [
          {
            label: t('pluto.form.unpublish'),
            icon: 'lucide:eye-off',
            onSelect: () => onSave(draftValue.value),
          },
        ]
      : []),
    ...(editing.value && canDelete.value
      ? [
          {
            label: t('pluto.common.delete'),
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
  <PlutoViewAdminPanel
    v-if="contentType"
    :aside-open="showAside && asideOpen && !inlineAside"
    :width="layout === 'focus' ? 'full' : 'container'"
  >
    <template #toolbar>
      <PlutoViewToolbar
        :back-to="basePath"
        :title="layout === 'focus' ? heading : undefined"
      >
        <template #right>
          <UBadge
            v-if="statusConfig"
            :color="isPublished ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ statusLabel }}
          </UBadge>

          <template v-for="action in toolbarActions" :key="action.id">
            <!-- prettier-ignore -->
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
            v-if="canSave && (!statusConfig || !isPublished)"
            :loading="saving"
            icon="lucide:save"
            variant="subtle"
            @click="onSave()"
          >
            {{ statusConfig ? t('pluto.form.saveDraft') : t('pluto.common.save') }}
          </UButton>

          <UButton
            v-if="canSave && statusConfig && isPublished"
            :loading="saving"
            icon="lucide:save"
            @click="onSave()"
          >
            {{ t('pluto.form.update') }}
          </UButton>

          <UButton
            v-if="canPublishNow && statusConfig && !isPublished"
            :loading="saving"
            icon="lucide:upload"
            @click="onSave(publishedValue)"
          >
            {{ t('pluto.form.publish') }}
          </UButton>

          <UDropdownMenu
            v-if="
              !loadFailed &&
              ((editing && canDelete) ||
                (statusConfig && isPublished && canPublish))
            "
            :items="unpublishDeleteItems"
          >
            <UTooltip :text="t('pluto.form.moreActions')">
              <UButton
                :aria-label="t('pluto.form.moreActions')"
                icon="lucide:ellipsis-vertical"
                color="neutral"
                variant="ghost"
                square
              />
            </UTooltip>
          </UDropdownMenu>

          <UTooltip
            v-if="showAsideToggle"
            :text="asideOpen ? t('pluto.form.hideSettings') : t('pluto.form.showSettings')"
          >
            <UButton
              :aria-label="asideOpen ? t('pluto.form.hideSettings') : t('pluto.form.showSettings')"
              :icon="
                asideOpen ? 'lucide:panel-right-close' : 'lucide:panel-right-open'
              "
              color="neutral"
              variant="ghost"
              square
              @click="toggleAside"
            />
          </UTooltip>
        </template>
      </PlutoViewToolbar>
    </template>

    <UAlert
      v-if="validationErrors.length > 0"
      :title="t('pluto.form.fixErrors')"
      color="error"
    >
      <template #description>
        <ul class="list-disc pl-4">
          <li v-for="fieldError in validationErrors" :key="fieldError.field">
            {{ validationText(fieldError) }}
          </li>
        </ul>
      </template>
    </UAlert>

    <h1 v-if="layout !== 'focus'" class="text-3xl font-bold lg:text-4xl">
      {{ heading }}
    </h1>

    <!-- The item did not load. Show the error and a retry button, and no fields. -->
    <UEmpty
      v-if="loadFailed"
      :title="loadNotFound ? t('pluto.form.notFound') : t('pluto.form.loadFailed')"
      :description="loadNotFound ? t('pluto.form.notFoundHint') : t('pluto.form.loadFailedHint')"
      :actions="loadFailedActions"
      icon="lucide:circle-alert"
      variant="naked"
    />

    <!-- The page and the fields show at once. A skeleton stands in while the item loads. -->
    <template v-else-if="itemPending">
      <PlutoSkeletonField v-for="field in mainFields" :key="field.name" :field-type="field.type" />
    </template>

    <template v-else>
      <PlutoContentField
        v-for="field in mainFields"
        :key="field.name"
        :type="type"
        :field="field"
        :model-value="item[field.name]"
        :disabled="!canWrite || saving"
        @update:model-value="updateField(field, $event)"
      />
    </template>

    <!-- On a narrow screen, the aside fields show here, under the main fields. -->
    <section
      v-if="inlineAside && !loadFailed"
      class="border-default flex flex-col gap-6 border-t pt-6"
    >
      <h2 class="text-highlighted text-xl font-semibold">
        {{ t('pluto.common.settings') }}
      </h2>

      <template v-if="itemPending">
        <PlutoSkeletonField v-for="field in sideFields" :key="field.name" :field-type="field.type" />
      </template>

      <template v-else>
        <PlutoContentField
          v-for="field in sideFields"
          :key="field.name"
          :type="type"
          :field="field"
          :model-value="item[field.name]"
          :disabled="!canWrite || saving"
          @update:model-value="updateField(field, $event)"
        />
      </template>
    </section>

    <template v-if="showAside && !inlineAside && !loadFailed" #aside>
      <PlutoViewAside v-model:open="asideOpen" :title="t('pluto.common.settings')">
        <div class="flex flex-col gap-6">
          <template v-if="itemPending">
            <PlutoSkeletonField v-for="field in sideFields" :key="field.name" :field-type="field.type" />
          </template>

          <template v-else>
            <PlutoContentField
              v-for="field in sideFields"
              :key="field.name"
              :type="type"
              :field="field"
              :model-value="item[field.name]"
              :disabled="!canWrite || saving"
              @update:model-value="updateField(field, $event)"
            />
          </template>
        </div>
      </PlutoViewAside>
    </template>
  </PlutoViewAdminPanel>

  <PlutoViewAdminPanel v-else>
    <UAlert
      :description="t('pluto.content.typeNotFoundDescription', { type })"
      :title="t('pluto.content.typeNotFound')"
      color="error"
    />
  </PlutoViewAdminPanel>

  <Modal v-model="isDeleteModalOpen" :custom-size="480">
    <ModalHeader @close="closeDeleteModal">
      {{ t('pluto.form.removeTitle', { label: text.label }) }}
    </ModalHeader>

    <ModalContent>
      <p>{{ t('pluto.content.removeConfirm') }}</p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          icon="lucide:x"
          variant="ghost"
          color="neutral"
          @click="closeDeleteModal"
        >
          {{ t('pluto.common.cancel') }}
        </UButton>

        <UButton
          :loading="deleting"
          icon="lucide:trash"
          color="error"
          @click="confirmDelete"
        >
          {{ t('pluto.common.remove') }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
