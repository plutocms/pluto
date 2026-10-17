<script setup lang="ts">
import type { ButtonProps, TableColumn } from '@nuxt/ui'

const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))

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
  return contentType.value?.editPath?.(id) ?? `${basePath.value}/${id}`
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

const number = new Intl.NumberFormat()

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
    return [{ label: 'Try again', icon: 'lucide:refresh-ccw', color: 'neutral', variant: 'outline', onClick: retry }]
  }
  return canWrite.value
    ? [{ label: `New ${type.label}`, icon: 'lucide:plus', onClick: () => navigateTo(newPath.value) }]
    : []
})

const listFields = computed(() =>
  (contentType.value?.fields ?? [])
    .filter((field) => field.inList)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
)

const columns = computed<TableColumn<PlutoContentItem>[]>(() => [
  ...listFields.value.map((field) => ({
    accessorKey: field.name,
    header: field.label,
  })),
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
</script>

<template>
  <PlutoViewAdminPanel v-if="contentType" fill>
    <template #toolbar>
      <PlutoViewToolbar :title="contentType.labelPlural">
        <template #trailing>
          <UButton
            :loading="pending"
            icon="lucide:refresh-ccw"
            variant="ghost"
            title="Refresh"
            square
            @click="retry"
          />
        </template>

        <template v-if="canWrite" #right>
          <UButton :to="newPath" icon="lucide:plus" as="NuxtLink">
            New {{ contentType.label }}
          </UButton>
        </template>
      </PlutoViewToolbar>
    </template>

    <UEmpty
      v-if="emptyState === 'loading'"
      :title="`Loading ${contentType.labelPlural.toLowerCase()}…`"
      variant="naked"
      loading
    />

    <UEmpty
      v-else-if="emptyState === 'error'"
      :title="`Could not load ${contentType.labelPlural.toLowerCase()}`"
      :actions="emptyActions"
      description="Check your connection and try again."
      icon="lucide:circle-alert"
      variant="naked"
    />

    <UEmpty
      v-else-if="emptyState === 'empty'"
      :title="`No ${contentType.labelPlural.toLowerCase()} yet`"
      :description="canWrite ? `Create the first ${contentType.label.toLowerCase()} to see it here.` : 'There is nothing here yet.'"
      :icon="contentType.icon ?? 'lucide:inbox'"
      :actions="emptyActions"
      variant="naked"
    />

    <UAlert
      v-if="!emptyState && error"
      :actions="[{ label: 'Try again', color: 'error', variant: 'outline', onClick: retry }]"
      :title="`Could not refresh ${contentType.labelPlural.toLowerCase()}`"
      description="The list below may be out of date."
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <div
      v-if="!emptyState"
      ref="mobileList"
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:hidden"
    >
      <UCard v-for="item in items" :key="item.id" class="shrink-0">
        <div class="flex flex-col gap-4">
          <div class="min-w-0">
            <NuxtLink
              :to="editPath(item.id)"
              class="block truncate text-lg font-semibold hover:underline"
            >
              {{ item[contentType.titleField] }}
            </NuxtLink>
          </div>

          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div v-for="field in listFields" :key="field.name">
              <dt class="text-muted">{{ field.label }}</dt>
              <dd class="font-medium">{{ item[field.name] }}</dd>
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
              Edit
            </UButton>

            <UButton
              v-if="canDelete"
              icon="lucide:trash"
              color="error"
              variant="soft"
              class="flex-1 justify-center"
              @click="openDeleteModal(item.id)"
            >
              Remove
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
      class="ring-default hidden min-h-0 flex-1 rounded-lg ring lg:block"
      empty="No items yet."
      sticky
      virtualize
    >
      <template #actions-cell="{ row }">
            <div class="flex justify-end gap-3">
              <NuxtLink
                v-if="canWrite"
                :to="editPath(row.original.id)"
                class="text-info px-0 py-0.5 hover:underline"
              >
                Edit
              </NuxtLink>

              <button
                v-if="canDelete"
                type="button"
                class="text-error cursor-pointer px-0 py-0.5 hover:underline"
                @click="openDeleteModal(row.original.id)"
              >
                Remove
              </button>
            </div>
      </template>
    </UTable>

    <p v-if="!emptyState" class="text-muted shrink-0 text-xs tabular-nums" aria-live="polite">
      Showing {{ number.format(items.length) }}
      <template v-if="total !== undefined">of {{ number.format(total) }}</template>
      {{ contentType.labelPlural.toLowerCase() }}
      <template v-if="loadingMore">· Loading more…</template>
    </p>
  </PlutoViewAdminPanel>

  <PlutoViewAdminPanel v-else>
    <UAlert
      :description="`No content type named &quot;${type}&quot; is registered.`"
      color="error"
      title="Content type not found"
    />
  </PlutoViewAdminPanel>

  <Modal v-model="isDeleteModalOpen" :custom-size="480">
    <ModalHeader @close="closeDeleteModal">Remove item</ModalHeader>

    <ModalContent>
      <p>Do you really want to remove this item?</p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          icon="lucide:x"
          variant="ghost"
          color="neutral"
          @click="closeDeleteModal"
        >
          Cancel
        </UButton>

        <UButton icon="lucide:trash" color="error" @click="confirmDelete">
          Remove
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
