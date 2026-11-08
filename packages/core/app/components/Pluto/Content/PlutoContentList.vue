<script setup lang="ts">
import type { ButtonProps, TableColumn } from '@nuxt/ui'
import type { PlutoAdminListQuery } from '../../../../shared/utils/content-list'
import type { PlutoBulkAction } from '../../../composables/internal/bulk-actions'
import {
  bulkStatusChange,
  runInBatches,
} from '../../../composables/internal/bulk-actions'
import {
  restorePlutoTrashItem,
  usePlutoContentTrashCount,
} from '../../../composables/pluto-content-trash'

const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))
const { t, n, d } = usePlutoI18n()
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
  return (
    contentType.value?.editPath?.(id) ??
    `${basePath.value}/${contentIdPath(id)}`
  )
}

// The search, the status, the filters and the sort live in the route query, so
// a reload, a link and the back button keep them. A value that the type does
// not allow is dropped. See `parseAdminListQuery`.
const route = useRoute()
const router = useRouter()
const listQuery = computed<PlutoAdminListQuery>(() =>
  contentType.value
    ? parseAdminListQuery(contentType.value, route.query).query
    : {}
)

// A search, a status or a filter narrows the list. A sort alone does not.
const narrowed = computed(() => isNarrowedListQuery(listQuery.value))

function isListQueryKey(key: string): boolean {
  return (
    key === 'search' ||
    key === 'status' ||
    key === 'sort' ||
    key.startsWith('filter[')
  )
}

/** Writes the list query to the route. The other keys of the route query stay. */
function setListQuery(next: PlutoAdminListQuery) {
  const kept = Object.fromEntries(
    Object.entries(route.query).filter(([key]) => !isListQueryKey(key))
  )
  router.replace({ query: { ...kept, ...adminListQueryKeys(next) } })
}

// Load the list 50 rows at a time. The table is virtualized, so only the
// visible rows render, and the next page loads when the user scrolls near
// the end of the table (or of the card list, on mobile).
const PAGE_SIZE = 50
const {
  items,
  total,
  pending,
  loadingMore,
  hasMore,
  error,
  refresh,
  loadMore,
  remove,
} = usePlutoContentList(props.type, { pageSize: PAGE_SIZE, query: listQuery })

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
useInfiniteScroll(() => tableRef.value?.$el, loadMoreSafely, {
  distance: 240,
  canLoadMore,
})
useInfiniteScroll(mobileListRef, loadMoreSafely, { distance: 240, canLoadMore })

// What to show while the list has no rows. With rows, the list shows
// them, and a failed refresh shows an alert above them instead.
const emptyState = computed<'loading' | 'error' | 'empty' | 'no-match' | null>(
  () => {
    if (items.value.length > 0) {
      return null
    }
    if (pending.value) {
      return 'loading'
    }
    if (error.value) {
      return 'error'
    }
    return narrowed.value ? 'no-match' : 'empty'
  }
)

function retry() {
  refresh().catch(() => {})
}

// The first page loads again while rows show (a search, a filter, the sort, a refresh). The rows
// dim and the table shows its bar until the new rows arrive. A next page (`loadingMore`) does
// not dim the rows: the footer says "Loading more".
const refreshing = computed(() => pending.value && items.value.length > 0)
const tableUi = computed(() => ({
  tr: 'group',
  thead: pending.value || loadingMore.value ? 'after:h-0.5' : undefined,
  tbody: refreshing.value
    ? 'opacity-50 transition-opacity'
    : 'transition-opacity',
}))

// Buttons navigate with `navigateTo`, not `to`: `to` is typed per app
// through typed pages, so a computed button list cannot type it here.
const emptyActions = computed<ButtonProps[]>(() => {
  const type = contentType.value
  if (!type) {
    return []
  }
  if (emptyState.value === 'error') {
    return [
      {
        label: t('pluto.common.tryAgain'),
        icon: 'lucide:refresh-ccw',
        color: 'neutral',
        variant: 'outline',
        onClick: retry,
      },
    ]
  }
  return canWrite.value
    ? [
        {
          label: text.newLabel,
          icon: 'lucide:plus',
          onClick: () => navigateTo(newPath.value),
        },
      ]
    : []
})

// The title of an item, or an empty string. The list shows "Untitled" for an
// item without one, so its row still has a link to open it.
function itemTitle(item: PlutoContentItem): string {
  const value = item[contentType.value?.titleField ?? '']
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

// The table slot of the title column. The title cell links to the edit page.
const titleCellSlot = computed(
  () => `${contentType.value?.titleField ?? ''}-cell`
)

const listFields = computed(() =>
  (contentType.value?.fields ?? [])
    .filter((field) => field.inList)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
)

// A `reference` field with a `target` shows the labels of the referenced items as badges.
function isReferenceColumn(field: PlutoField): field is PlutoReferenceField {
  return isTargetReference(field)
}

// The fields of a card on a small screen. The title is the card heading.
const cardFields = computed(() =>
  listFields.value.filter(
    (field) => field.name !== contentType.value?.titleField
  )
)

// The status of each item, for a type with a publish workflow. A draft shows
// a neutral badge, a published item a green one, as in the form toolbar.
const statusConfig = computed(() => contentType.value?.status || null)

// Bulk actions on the rows of the table. Publish and Unpublish need a workflow
// and the publish capability, Remove needs the delete capability.
const canBulkStatus = computed(
  () => Boolean(statusConfig.value) && canPublish.value
)
const canBulk = computed(() => canBulkStatus.value || canDelete.value)

// The search waits 300 ms after the last key. A change of the route (the back
// button, "Clear the filters") puts its text back in the box.
const searchText = ref(listQuery.value.search ?? '')
const applySearch = useDebounceFn((value: string) => {
  setListQuery({ ...listQuery.value, search: value.trim() || undefined })
}, 300)
watch(searchText, (value) => {
  applySearch(value)
})
watch(
  () => listQuery.value.search ?? '',
  (value) => {
    if (value !== searchText.value.trim()) {
      searchText.value = value
    }
  }
)

// The values of the type, plus In review and Scheduled when the type has them.
const statusItems = computed(() =>
  contentStatusValues(contentType.value).map((entry) => ({
    label: text.statusLabel(entry.value, entry.label),
    value: entry.value,
  }))
)

// The fields that filter, with their translated labels and options.
const filterFields = computed(() =>
  contentType.value
    ? listFilterFields(contentType.value).map((field) => text.field(field))
    : []
)

function setStatus(value: string | undefined) {
  setListQuery({ ...listQuery.value, status: value })
}

function setFilter(name: string, value: string | undefined) {
  const filters = { ...listQuery.value.filters }
  if (value === undefined) {
    delete filters[name]
  } else {
    filters[name] = value
  }
  setListQuery({ ...listQuery.value, filters })
}

/** Removes the search, the status and the filters. The sort stays. */
function clearFilters() {
  searchText.value = ''
  setListQuery({ sort: listQuery.value.sort })
}

// A sortable column header goes: ascending, descending, then the default sort.
function sortState(name: string): 'asc' | 'desc' | undefined {
  const sort = listQuery.value.sort
  return sort?.field === name ? sort.direction : undefined
}

function toggleSort(name: string) {
  const state = sortState(name)
  setListQuery({
    ...listQuery.value,
    sort:
      state === undefined
        ? { field: name, direction: 'asc' }
        : state === 'asc'
          ? { field: name, direction: 'desc' }
          : undefined,
  })
}

function sortIcon(name: string): string {
  const state = sortState(name)
  if (state === 'asc') {
    return 'lucide:arrow-up'
  }
  return state === 'desc' ? 'lucide:arrow-down' : 'lucide:arrow-up-down'
}

const sortFields = computed(() => listFields.value.filter(isListSortField))

// The badge of an item: green when published, blue with the date when scheduled, amber in review.
function itemStatus(item: PlutoContentItem): {
  label: string
  color: 'success' | 'neutral' | 'info' | 'warning'
} | null {
  const config = statusConfig.value
  const rules = statusRules(contentType.value)
  if (!config || !rules) {
    return null
  }
  const value = (item.status as string | undefined) ?? config.default
  if (value === undefined) {
    return null
  }
  if (value === rules.scheduled && rules.publishedAtColumn) {
    const time = statusTime(item[rules.publishedAtColumn])
    // A due item is live: the task sets its status soon.
    if (time !== undefined && time <= Date.now()) {
      return {
        label: text.statusLabel(rules.published),
        color: 'success',
      }
    }
    if (time !== undefined) {
      return {
        label: t('pluto.form.scheduledFor', {
          date: d(new Date(time), { dateStyle: 'medium', timeStyle: 'short' }),
        }),
        color: 'info',
      }
    }
  }
  const literal = config.values.find((entry) => entry.value === value)?.label
  return {
    label: text.statusLabel(value, literal),
    color:
      value === rules.published
        ? 'success'
        : value === rules.review
          ? 'warning'
          : 'neutral',
  }
}

const columns = computed<TableColumn<PlutoContentItem>[]>(() => [
  ...(canBulk.value ? [{ id: 'select', header: '' }] : []),
  ...listFields.value.map((field) => ({
    accessorKey: field.name,
    header: text.fieldLabel(field),
    ...(field.listFormat
      ? {
          cell: ({
            row,
          }: {
            row: {
              original: PlutoContentItem
            }
          }) => formatListValue(field, row.original),
        }
      : {}),
  })),
  ...(statusConfig.value
    ? [{ id: 'status', header: t('pluto.list.status') }]
    : []),
  { id: 'actions', header: '' },
])

const toast = useToast()
const errorText = usePlutoErrorText()

const pendingDeleteId = ref<string | number | null>(null)
const isDeleteModalOpen = ref(false)
const deleting = ref(false)

// The selected rows, by the text of their id. Only loaded rows can be selected.
const selected = ref<Set<string>>(new Set())
const selectedItems = computed(() =>
  items.value.filter((item) => selected.value.has(String(item.id)))
)
const allSelected = computed(
  () =>
    items.value.length > 0 && selectedItems.value.length === items.value.length
)

function toggleRow(id: string | number, on: boolean) {
  const next = new Set(selected.value)
  if (on) {
    next.add(String(id))
  } else {
    next.delete(String(id))
  }
  selected.value = next
}

function toggleAll(on: boolean) {
  selected.value = on
    ? new Set(items.value.map((item) => String(item.id)))
    : new Set()
}

function clearSelection() {
  selected.value = new Set()
}

// Another search, filter or sort shows other rows: the selection goes.
watch(() => JSON.stringify(adminListQueryKeys(listQuery.value)), clearSelection)

// Remove with the dialog: one item, or the selected items.
const bulkRemove = ref(false)
const bulkRunning = ref<PlutoBulkAction | null>(null)

function itemUrl(id: string | number): string {
  return `/api/_pluto/content/${props.type}/${contentIdPath(id)}`
}

/** Runs one request per item, 4 at a time, then shows one toast and loads the list again. */
async function runBulk(
  action: PlutoBulkAction,
  ids: Array<string | number>,
  task: (id: string | number) => Promise<unknown>
) {
  bulkRunning.value = action
  try {
    const { done, failed } = await runInBatches(ids, task)
    toast.add({
      title: t(`pluto.list.bulk.${action}Done`, { count: n(done) }),
      description: failed
        ? t('pluto.list.bulk.failed', { count: n(failed) })
        : undefined,
      color: failed ? 'warning' : 'success',
    })
  } finally {
    bulkRunning.value = null
    clearSelection()
    retry()
  }
}

function bulkStatus(action: 'publish' | 'unpublish') {
  if (bulkRunning.value) {
    return
  }
  const change = bulkStatusChange(
    selectedItems.value,
    action,
    statusConfig.value ?? undefined
  )
  if (!change || change.ids.length === 0) {
    toast.add({ title: t('pluto.list.bulk.nothing'), color: 'neutral' })
    return
  }
  // Each task awaits and returns nothing. A returned $fetch promise makes TypeScript compare the
  // answers of every typed route of the app, which is too deep in a large app.
  void runBulk(action, change.ids, async (id) => {
    await $fetch(itemUrl(id), {
      method: 'PATCH',
      body: { status: change.status },
    })
  })
}

// A type with a trash: Remove moves the items to the trash at once, with Undo in the toast, and
// the list has the tabs All and Trash (`?trash=1`). Without one, Remove asks and is final.
const trashEnabled = computed(
  () => Boolean(contentType.value?.trash) && canDelete.value
)
const trashView = computed(
  () => trashEnabled.value && route.query.trash === '1'
)
const trashCounter =
  contentType.value?.trash && canDelete.value
    ? usePlutoContentTrashCount(props.type)
    : null

// The All list stays loaded under the Trash tab, but a restore or a purge there changes it. So it
// loads again when the view comes back to All.
watch(trashView, (now, before) => {
  if (before && !now) {
    retry()
  }
})

async function undoTrash(ids: Array<string | number>) {
  const { done, failed } = await runInBatches(ids, (id) =>
    restorePlutoTrashItem(props.type, id)
  )
  toast.add({
    title: t('pluto.list.trash.restoredMany', { count: n(done) }),
    description: failed
      ? t('pluto.list.bulk.failed', { count: n(failed) })
      : undefined,
    color: failed ? 'warning' : 'success',
  })
  retry()
  void trashCounter?.refresh()
}

async function moveToTrash(ids: Array<string | number>) {
  if (bulkRunning.value) {
    return
  }
  bulkRunning.value = 'remove'
  const moved: Array<string | number> = []
  try {
    const { failed } = await runInBatches(ids, async (id) => {
      await $fetch(itemUrl(id), { method: 'DELETE' })
      moved.push(id)
    })
    toast.add({
      title:
        ids.length === 1 && moved.length === 1
          ? t('pluto.list.trash.moved')
          : t('pluto.list.trash.movedMany', { count: n(moved.length) }),
      description: failed
        ? t('pluto.list.bulk.failed', { count: n(failed) })
        : undefined,
      color: failed ? 'warning' : 'success',
      ...(moved.length > 0 && {
        actions: [
          {
            label: t('pluto.list.trash.undo'),
            icon: 'lucide:undo-2',
            color: 'neutral' as const,
            variant: 'outline' as const,
            onClick: () => {
              void undoTrash(moved)
            },
          },
        ],
      }),
    })
  } finally {
    bulkRunning.value = null
    clearSelection()
    retry()
    void trashCounter?.refresh()
  }
}

/** Remove of one row: to the trash at once, or the final delete with the dialog. */
function removeItem(id: string | number) {
  if (trashEnabled.value) {
    void moveToTrash([id])
  } else {
    openDeleteModal(id)
  }
}

function openBulkRemove() {
  if (trashEnabled.value) {
    void moveToTrash(selectedItems.value.map((item) => item.id))
    return
  }
  bulkRemove.value = true
  isDeleteModalOpen.value = true
}

function openDeleteModal(id: string | number) {
  pendingDeleteId.value = id
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  // The dialog stays open while the delete runs, so the user sees it finish.
  if (deleting.value) {
    return
  }
  pendingDeleteId.value = null
  bulkRemove.value = false
  isDeleteModalOpen.value = false
}

async function confirmDelete() {
  if (deleting.value) {
    return
  }
  if (bulkRemove.value) {
    deleting.value = true
    await runBulk(
      'remove',
      selectedItems.value.map((item) => item.id),
      async (id) => {
        await $fetch(itemUrl(id), { method: 'DELETE' })
      }
    )
    deleting.value = false
    closeDeleteModal()
    return
  }
  if (pendingDeleteId.value === null) {
    return
  }

  deleting.value = true
  try {
    await remove(pendingDeleteId.value)
    deleting.value = false
    closeDeleteModal()
  } catch (caught) {
    toast.add({
      title: t('pluto.common.error'),
      description: errorText(caught, 'pluto.form.removeError'),
      color: 'error',
    })
  } finally {
    deleting.value = false
  }
}

// The footer line: "Showing 5 of 20 posts", plus "Loading more…" while a
// page loads. The phrase has the plural label as a parameter, so a language
// can put it anywhere.
const footer = computed(() => {
  const params = {
    loaded: n(items.value.length),
    total: total.value === undefined ? '' : n(total.value),
    labelPlural: text.labelPluralLower,
  }
  const summary = t(
    total.value === undefined ? 'pluto.list.showing' : 'pluto.list.showingOf',
    params
  )
  return loadingMore.value
    ? `${summary} · ${t('pluto.list.loadingMore')}`
    : summary
})
</script>

<template>
  <PlutoViewAdminPanel v-if="contentType" fill>
    <template #toolbar>
      <PlutoViewToolbar :title="text.labelPlural">
        <template v-if="!trashView" #trailing>
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
      <!-- The tabs of the menu item that holds this list (for example Pages). -->
      <PlutoAdminNavTabs variant="toolbar" />
      <PlutoContentListTabs
        v-if="trashEnabled"
        :view="trashView ? 'trash' : 'all'"
        :count="trashCounter?.count.value ?? null"
      />
    </template>

    <PlutoContentTrash
      v-if="trashView"
      :type="type"
      @changed="trashCounter?.refresh()"
    />

    <template v-else>
      <!-- The bulk actions, while rows are selected. They take the place of the filters. -->
      <div
        v-if="selectedItems.length > 0"
        class="bg-elevated flex shrink-0 flex-wrap items-center gap-2 rounded-lg px-3 py-1.5"
      >
        <span class="text-highlighted me-2 text-sm font-medium tabular-nums">
          {{
            t('pluto.list.bulk.selected', { count: n(selectedItems.length) })
          }}
        </span>
        <template v-if="canBulkStatus">
          <UButton
            :label="t('pluto.list.bulk.publish')"
            :loading="bulkRunning === 'publish'"
            :disabled="bulkRunning !== null"
            icon="lucide:globe"
            color="neutral"
            variant="outline"
            size="sm"
            @click="bulkStatus('publish')"
          />
          <UButton
            :label="t('pluto.list.bulk.unpublish')"
            :loading="bulkRunning === 'unpublish'"
            :disabled="bulkRunning !== null"
            icon="lucide:eye-off"
            color="neutral"
            variant="outline"
            size="sm"
            @click="bulkStatus('unpublish')"
          />
        </template>
        <UButton
          v-if="canDelete"
          :label="
            trashEnabled
              ? t('pluto.list.trash.move')
              : t('pluto.list.bulk.remove')
          "
          :loading="bulkRunning === 'remove'"
          :disabled="bulkRunning !== null"
          icon="lucide:trash"
          color="error"
          variant="soft"
          size="sm"
          @click="openBulkRemove"
        />
        <UButton
          :label="t('pluto.list.bulk.clear')"
          :disabled="bulkRunning !== null"
          icon="lucide:x"
          color="neutral"
          variant="ghost"
          size="sm"
          class="ms-auto"
          @click="clearSelection"
        />
      </div>

      <!-- The search and the filters. Not on an empty type: there is nothing to narrow. -->
      <div
        v-else-if="emptyState !== 'empty'"
        class="flex shrink-0 flex-wrap items-center gap-2"
      >
        <UInput
          v-model="searchText"
          :placeholder="
            t('pluto.list.search', { labelPlural: text.labelPluralLower })
          "
          :aria-label="
            t('pluto.list.search', { labelPlural: text.labelPluralLower })
          "
          icon="lucide:search"
          class="min-w-48 flex-1"
        />
        <PlutoContentListFilter
          v-if="statusItems.length > 0"
          :label="t('pluto.list.status')"
          :items="statusItems"
          :model-value="listQuery.status"
          @update:model-value="setStatus"
        />
        <PlutoContentListFilter
          v-for="field in filterFields"
          :key="field.name"
          :label="field.label"
          :field="field"
          :model-value="listQuery.filters?.[field.name]"
          @update:model-value="(value) => setFilter(field.name, value)"
        />
        <UButton
          v-if="narrowed"
          :label="t('pluto.list.clearFilters')"
          icon="lucide:x"
          color="neutral"
          variant="ghost"
          @click="clearFilters"
        />
      </div>

      <PlutoSkeletonList
        v-if="emptyState === 'loading'"
        :columns="listFields.map((field) => text.fieldLabel(field))"
        :status="Boolean(statusConfig)"
        :aria-label="
          t('pluto.list.loading', { labelPlural: text.labelPluralLower })
        "
        aria-busy="true"
      />

      <UEmpty
        v-else-if="emptyState === 'error'"
        :title="
          t('pluto.list.loadFailed', { labelPlural: text.labelPluralLower })
        "
        :actions="emptyActions"
        :description="t('pluto.list.loadFailedHint')"
        icon="lucide:circle-alert"
        variant="naked"
      />

      <UEmpty
        v-else-if="emptyState === 'empty'"
        :title="t('pluto.list.empty', { labelPlural: text.labelPluralLower })"
        :description="
          canWrite
            ? t('pluto.list.emptyCanWrite', { label: text.labelLower })
            : t('pluto.list.emptyReadOnly')
        "
        :icon="contentType.icon ?? 'lucide:inbox'"
        :actions="emptyActions"
        variant="naked"
      />

      <UEmpty
        v-else-if="emptyState === 'no-match'"
        :title="t('pluto.list.noMatch', { labelPlural: text.labelPluralLower })"
        :description="t('pluto.list.noMatchHint')"
        :actions="[
          {
            label: t('pluto.list.clearFilters'),
            icon: 'lucide:x',
            color: 'neutral',
            variant: 'outline',
            onClick: clearFilters,
          },
        ]"
        icon="lucide:search-x"
        variant="naked"
      />

      <UAlert
        v-if="!emptyState && error"
        :actions="[
          {
            label: t('pluto.common.tryAgain'),
            color: 'error',
            variant: 'outline',
            onClick: retry,
          },
        ]"
        :title="
          t('pluto.list.refreshFailed', { labelPlural: text.labelPluralLower })
        "
        :description="t('pluto.list.refreshFailedHint')"
        color="error"
        variant="subtle"
        icon="lucide:circle-alert"
      />

      <div
        v-if="!emptyState"
        ref="mobileList"
        :aria-busy="refreshing"
        :class="refreshing ? 'opacity-50' : undefined"
        class="flex min-h-0 flex-col gap-3 overflow-y-auto transition-opacity lg:hidden"
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
                :color="itemStatus(item)!.color"
                variant="subtle"
                class="shrink-0"
              >
                {{ itemStatus(item)!.label }}
              </UBadge>
            </div>

            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div v-for="field in cardFields" :key="field.name">
                <dt class="text-muted">
                  {{ text.fieldLabel(field) }}
                </dt>
                <dd class="font-medium">
                  <PlutoContentReferenceCell
                    v-if="isReferenceColumn(field)"
                    :field="field"
                    :value="item[field.name]"
                  />
                  <template v-else>
                    {{ formatListValue(field, item) }}
                  </template>
                </dd>
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
                @click="removeItem(item.id)"
              >
                {{
                  trashEnabled
                    ? t('pluto.list.trash.move')
                    : t('pluto.common.remove')
                }}
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
        :ui="tableUi"
        :aria-busy="refreshing"
        class="ring-default hidden min-h-0 rounded-lg ring lg:block"
        sticky
        virtualize
      >
        <template #[titleCellSlot]="{ row }">
          <NuxtLink
            :to="editPath(row.original.id)"
            :class="
              itemTitle(row.original) ? 'text-highlighted' : 'text-muted italic'
            "
            class="font-medium hover:underline"
          >
            {{ itemTitle(row.original) || t('pluto.content.untitled') }}
          </NuxtLink>
        </template>

        <template
          v-for="field in listFields.filter(isReferenceColumn)"
          :key="field.name"
          #[`${field.name}-cell`]="{ row }"
        >
          <PlutoContentReferenceCell
            :field="field"
            :value="row.original[field.name]"
          />
        </template>

        <!-- A sortable column: the header is a button (ascending, descending, default). -->
        <template
          v-for="field in sortFields"
          :key="field.name"
          #[`${field.name}-header`]
        >
          <button
            :aria-label="
              t('pluto.list.sortBy', { label: text.fieldLabel(field) })
            "
            :class="sortState(field.name) ? 'text-highlighted' : undefined"
            type="button"
            class="hover:text-highlighted -mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5"
            @click="toggleSort(field.name)"
          >
            {{ text.fieldLabel(field) }}
            <UIcon
              :name="sortIcon(field.name)"
              :class="sortState(field.name) ? undefined : 'opacity-40'"
              class="size-3.5"
            />
            <span v-if="sortState(field.name)" class="sr-only">
              {{
                t(
                  sortState(field.name) === 'asc'
                    ? 'pluto.list.sortedAsc'
                    : 'pluto.list.sortedDesc'
                )
              }}
            </span>
          </button>
        </template>

        <template #select-header>
          <UCheckbox
            :model-value="
              allSelected
                ? true
                : selectedItems.length > 0
                  ? 'indeterminate'
                  : false
            "
            :aria-label="t('pluto.list.bulk.selectAll')"
            @update:model-value="(value) => toggleAll(value === true)"
          />
        </template>

        <template #select-cell="{ row }">
          <UCheckbox
            :model-value="selected.has(String(row.original.id))"
            :aria-label="
              t('pluto.list.bulk.selectRow', {
                title: itemTitle(row.original) || t('pluto.content.untitled'),
              })
            "
            @update:model-value="
              (value) => toggleRow(row.original.id, value === true)
            "
          />
        </template>

        <template #status-cell="{ row }">
          <UBadge
            v-if="itemStatus(row.original)"
            :color="itemStatus(row.original)!.color"
            variant="subtle"
          >
            {{ itemStatus(row.original)!.label }}
          </UBadge>
        </template>

        <!--
        Edit and Remove show on row hover. They keep their place (opacity only), and stay visible
        on a device without hover and while they hold the keyboard focus.
      -->
        <template #actions-cell="{ row }">
          <div
            class="flex justify-end gap-3 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
          >
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
              @click="removeItem(row.original.id)"
            >
              {{
                trashEnabled
                  ? t('pluto.list.trash.move')
                  : t('pluto.common.remove')
              }}
            </button>
          </div>
        </template>
      </UTable>

      <p
        v-if="!emptyState"
        class="text-muted shrink-0 text-xs tabular-nums"
        aria-live="polite"
      >
        {{ footer }}
      </p>
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
      {{
        bulkRemove
          ? t('pluto.list.bulk.removeTitle')
          : t('pluto.list.removeTitle')
      }}
    </ModalHeader>

    <ModalContent>
      <p>
        {{
          bulkRemove
            ? t('pluto.list.bulk.removeConfirm', {
                count: n(selectedItems.length),
              })
            : t('pluto.content.removeConfirm')
        }}
      </p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          :disabled="deleting"
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
