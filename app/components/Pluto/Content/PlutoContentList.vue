<script setup lang="ts">
import type { ButtonProps, TableColumn } from '@nuxt/ui'

const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))
const { t, n } = usePlutoI18n()
const text = usePlutoContentText(contentType)

if (!contentType.value) {
  // The generated page (`app/pages/admin/content/[type]/index.vue`) already
  // resolves the type and 404s before this component ever mounts, so this
  // should not normally happen.
  console.error(
    `PlutoContentList: content type "${props.type}" was not found in the registry.`
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
const canDelete = computed(
  () =>
    !contentType.value?.capabilities?.delete ||
    can(contentType.value.capabilities.delete)
)

const basePath = computed(
  () => contentType.value?.basePath ?? `/admin/content/${props.type}`
)

// newPath/editPath exist so an already-deployed layer's URLs never have
// to change to adopt this component — see the doc comments on
// PlutoContentType.newPath/editPath for why a single basePath cannot
// always express both.
const newPath = computed(
  () => contentType.value?.newPath ?? `${basePath.value}/new`
)
function editPath(id: string | number) {
  return contentType.value?.editPath?.(id) ?? `${basePath.value}/${contentIdPath(id)}`
}

// Load the list 50 rows at a time. The table is virtualized, so only the
// visible rows render, and the next page loads when the user scrolls near
// the end of the table (or of the card list, on mobile).
const PAGE_SIZE = 50
const { items, total, pending, loadingMore, hasMore, error, refresh, loadMore, remove } = usePlutoContentList(
  props.type,
  { pageSize: PAGE_SIZE }
)

const tableRef = useTemplateRef<{
 $el: HTMLElement
}>('table')
const mobileListRef = useTemplateRef<HTMLElement>('mobileList')

function loadMoreSafely() {
  // A failure lands in `error`, and the alert offers "Try again".
  loadMore().catch(() => {})
}

// Stop while an error shows, so a failing page does not load in a loop.
const canLoadMore = () => hasMore.value && !error.value
useInfiniteScroll(() => tableRef.value?.$el, loadMoreSafely, { distance: 240, canLoadMore })
useInfiniteScroll(mobileListRef, loadMoreSafely, { distance: 240, canLoadMore })

// What to show while the list has no rows. With rows, the list shows
// them, and a failed refresh shows an alert above them instead.
const emptyState = computed<'loading' | 'error' | 'empty' | null>(() => {
  if (items.value.length > 0) {
    return null
  }
  if (pending.value) {
    return 'loading'
  }
  return error.value ? 'error' : 'empty'
})

function retry() {
  refresh().catch(() => {})
}

// Buttons navigate with `navigateTo`, not `to`: `to` is typed per app
// through typed pages, so a computed button list cannot type it here.
const emptyActions = computed<ButtonProps[]>(() => {
  const type = contentType.value
  if (!type) {
    return []
  }
  if (emptyState.value === 'error') {
    return [{ label: t('pluto.common.tryAgain'), icon: 'lucide:refresh-ccw', color: 'neutral', variant: 'outline', onClick: retry }]
  }
  return canWrite.value
    ? [{ label: text.newLabel, icon: 'lucide:plus', onClick: () => navigateTo(newPath.value) }]
    : []
})

// The title of an item, or an empty string. The list shows "Untitled" for an
// item without one, so its row still has a link to open it.
function itemTitle(item: PlutoContentItem): string {
  const value = item[contentType.value?.titleField ?? '']
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
}

// The table slot of the title column. The title cell links to the edit page.
const titleCellSlot = computed(() => `${contentType.value?.titleField ?? ''}-cell`)

const listFields = computed(() =>
  (contentType.value?.fields ?? [])
    .filter((field) => field.inList)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
)

// The fields of a card on a small screen. The title is the card heading.
const cardFields = computed(() => listFields.value.filter((field) => field.name !== contentType.value?.titleField))

// The status of each item, for a type with a publish workflow. A draft shows
// a neutral badge, a published item a green one, as in the form toolbar.
const statusConfig = computed(() => contentType.value?.status || null)

function itemStatus(item: PlutoContentItem): {
 label: string
published: boolean
} | null {
  const config = statusConfig.value
  if (!config) {
    return null
  }
  const value = (item.status as string | undefined) ?? config.default
  if (value === undefined) {
    return null
  }
  const literal = config.values.find((entry) => entry.value === value)?.label
  return { label: text.statusLabel(value, literal), published: value === (config.publishedValue ?? 'published') }
}

const columns = computed<TableColumn<PlutoContentItem>[]>(() => [
  ...listFields.value.map((field) => ({
    accessorKey: field.name,
    header: text.fieldLabel(field),
    ...(field.listFormat
? { cell: ({ row }: {
 row: {
 original: PlutoContentItem
}
}) => formatListValue(field, row.original) }
: {}),
  })),
  ...(statusConfig.value ? [{ id: 'status', header: t('pluto.list.status') }] : []),
  { id: 'actions', header: '' },
])

const pendingDeleteId = ref<string | number | null>(null)
const isDeleteModalOpen = ref(false)

function openDeleteModal(id: string | number) {
  pendingDeleteId.value = id
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  pendingDeleteId.value = null
  isDeleteModalOpen.value = false
}

async function confirmDelete() {
  if (pendingDeleteId.value === null) {
    return
  }

  await remove(pendingDeleteId.value)
  closeDeleteModal()
}

// The footer line: "Showing 5 of 20 posts", plus "Loading more…" while a
// page loads. The phrase has the plural label as a parameter, so a language
// can put it anywhere.
const footer = computed(() => {
  const params = { loaded: n(items.value.length), total: total.value === undefined ? '' : n(total.value), labelPlural: text.labelPluralLower }
  const summary = t(total.value === undefined ? 'pluto.list.showing' : 'pluto.list.showingOf', params)
  return loadingMore.value ? `${summary} · ${t('pluto.list.loadingMore')}` : summary
})
</script>

<template>
  <PlutoViewAdminPanel v-if="contentType" fill>
    <template #toolbar>
      <PlutoViewToolbar :title="text.labelPlural">
        <template #trailing>
          <UButton
            :loading="pending"
            :title="t('pluto.common.refresh')"
            icon="lucide:refresh-ccw"
            variant="ghost"
            square
            @click="retry"
          />
        </template>

        <template v-if="canWrite" #right>
          <UButton :to="newPath" icon="lucide:plus" as="NuxtLink">
            {{ text.newLabel }}
          </UButton>
        </template>
      </PlutoViewToolbar>
    </template>

    <UEmpty
      v-if="emptyState === 'loading'"
      :title="t('pluto.list.loading', { labelPlural: text.labelPluralLower })"
      variant="naked"
      loading
    />

    <UEmpty
      v-else-if="emptyState === 'error'"
      :title="t('pluto.list.loadFailed', { labelPlural: text.labelPluralLower })"
      :actions="emptyActions"
      :description="t('pluto.list.loadFailedHint')"
      icon="lucide:circle-alert"
      variant="naked"
    />

    <UEmpty
      v-else-if="emptyState === 'empty'"
      :title="t('pluto.list.empty', { labelPlural: text.labelPluralLower })"
      :description="canWrite ? t('pluto.list.emptyCanWrite', { label: text.labelLower }) : t('pluto.list.emptyReadOnly')"
      :icon="contentType.icon ?? 'lucide:inbox'"
      :actions="emptyActions"
      variant="naked"
    />

    <UAlert
      v-if="!emptyState && error"
      :actions="[{ label: t('pluto.common.tryAgain'), color: 'error', variant: 'outline', onClick: retry }]"
      :title="t('pluto.list.refreshFailed', { labelPlural: text.labelPluralLower })"
      :description="t('pluto.list.refreshFailedHint')"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <div
      v-if="!emptyState"
      ref="mobileList"
      class="flex min-h-0 flex-col gap-3 overflow-y-auto lg:hidden"
    >
      <UCard v-for="item in items" :key="item.id" class="shrink-0">
        <div class="flex flex-col gap-4">
          <div class="flex min-w-0 items-center justify-between gap-3">
            <NuxtLink
              :to="editPath(item.id)"
              :class="itemTitle(item) ? undefined : 'text-muted italic'"
              class="block truncate text-lg font-semibold hover:underline"
            >
              {{ itemTitle(item) || t('pluto.content.untitled') }}
            </NuxtLink>

            <UBadge
              v-if="itemStatus(item)"
              :color="itemStatus(item)!.published ? 'success' : 'neutral'"
              variant="subtle"
              class="shrink-0"
            >
              {{ itemStatus(item)!.label }}
            </UBadge>
          </div>

          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div v-for="field in cardFields" :key="field.name">
              <dt class="text-muted">{{ text.fieldLabel(field) }}</dt>
              <dd class="font-medium">{{ formatListValue(field, item) }}</dd>
            </div>
          </dl>

          <div class="border-default flex gap-2 border-t pt-3">
            <UButton
              v-if="canWrite"
              :to="editPath(item.id)"
              icon="lucide:pen-line"
              color="neutral"
              variant="soft"
              class="flex-1 justify-center"
            >
              {{ t('pluto.common.edit') }}
            </UButton>

            <UButton
              v-if="canDelete"
              icon="lucide:trash"
              color="error"
              variant="soft"
              class="flex-1 justify-center"
              @click="openDeleteModal(item.id)"
            >
              {{ t('pluto.common.remove') }}
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <UTable
      v-if="!emptyState"
      ref="table"
      :data="items"
      :columns="columns"
      :loading="pending || loadingMore"
      :empty="t('pluto.list.emptyTable')"
      class="ring-default hidden min-h-0 rounded-lg ring lg:block"
      sticky
      virtualize
    >
      <template #[titleCellSlot]="{ row }">
        <NuxtLink
          :to="editPath(row.original.id)"
          :class="itemTitle(row.original) ? 'text-highlighted' : 'text-muted italic'"
          class="font-medium hover:underline"
        >
          {{ itemTitle(row.original) || t('pluto.content.untitled') }}
        </NuxtLink>
      </template>

      <template #status-cell="{ row }">
        <UBadge
          v-if="itemStatus(row.original)"
          :color="itemStatus(row.original)!.published ? 'success' : 'neutral'"
          variant="subtle"
        >
          {{ itemStatus(row.original)!.label }}
        </UBadge>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-3">
          <NuxtLink
            v-if="canWrite"
            :to="editPath(row.original.id)"
            class="text-info px-0 py-0.5 hover:underline"
          >
            {{ t('pluto.common.edit') }}
          </NuxtLink>

          <button
            v-if="canDelete"
            type="button"
            class="text-error cursor-pointer px-0 py-0.5 hover:underline"
            @click="openDeleteModal(row.original.id)"
          >
            {{ t('pluto.common.remove') }}
          </button>
        </div>
      </template>
    </UTable>

    <p v-if="!emptyState" class="text-muted shrink-0 text-xs tabular-nums" aria-live="polite">
      {{ footer }}
    </p>
  </PlutoViewAdminPanel>

  <PlutoViewAdminPanel v-else>
    <UAlert
      :description="t('pluto.content.typeNotFoundDescription', { type })"
      :title="t('pluto.content.typeNotFound')"
      color="error"
    />
  </PlutoViewAdminPanel>

  <Modal v-model="isDeleteModalOpen" :custom-size="480">
    <ModalHeader @close="closeDeleteModal">{{ t('pluto.list.removeTitle') }}</ModalHeader>

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

        <UButton icon="lucide:trash" color="error" @click="confirmDelete">
          {{ t('pluto.common.remove') }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
