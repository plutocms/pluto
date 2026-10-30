<script setup lang="ts">
// The media library: search, the kinds of files, sort, a grid or a list,
// uploads with progress (a button, or drop files anywhere on it), and "Show
// more". Two modes:
// - `manage` (the Media page): a click opens a file in the details (`active`);
//   the check boxes select files for the bulk actions (copy the URLs, delete).
// - `select` (the picker): a click selects a file (`selected`), one or many. A
//   double-click on a file picks it at once (`confirm`).
// See the media skill.
import type { PlutoMedia, PlutoMediaSort } from '../../../../shared/types/media'
import type { PlutoMediaKind } from '../../../../shared/types/registry'
import { PlutoMediaUploadProblem } from '../../../composables/pluto-media'
import { PlutoMediaDecodeError } from '../../../utils/pluto-media-image'

const props = withDefaults(
  defineProps<{
    mode?: 'manage' | 'select'
    multiple?: boolean
    /** The file types to show and to take: `['image/*']`. All when unset. */
    accept?: string[]
  }>(),
  { mode: 'manage', multiple: false, accept: undefined }
)

const emit = defineEmits<{
  confirm: [media: PlutoMedia]
  deleted: [ids: string[]]
}>()

const selected = defineModel<PlutoMedia[]>('selected', { default: () => [] })
const active = defineModel<PlutoMedia | null>('active', { default: null })

const PAGE_SIZE = 40

const { t, tx, d, locale } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { can } = usePlutoPermissions()
const media = usePlutoMedia()
const toast = useToast()

const canUpload = computed(() => can('media:manage'))
const canDelete = computed(() => can('media:delete'))

// The view and the order stay for the next visit.
const view = useCookie<'grid' | 'list'>('pluto-media-view', {
  default: () => 'grid',
  sameSite: 'lax',
})
const sort = useCookie<PlutoMediaSort>('pluto-media-sort', {
  default: () => 'newest',
  sameSite: 'lax',
})

const items = ref<PlutoMedia[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const search = ref('')
/** `all`, or the id of a kind. */
const kindFilter = ref('all')

/** The kinds that this library can show: all of them, or the ones `accept` takes. */
const kinds = computed(() =>
  media.kinds.items.value.filter(
    (kind) =>
      !props.accept ||
      kind.accept.some((pattern) =>
        matchesMediaType(pattern.replace('/*', '/x'), props.accept)
      )
  )
)

/** The `type` query of a kind: `image` for `image/*`, else its first type. */
function kindQuery(kind: PlutoMediaKind): string {
  const first = kind.accept[0] ?? ''
  return first === 'image/*' ? 'image' : first.replace(/\*$/, '')
}

const typeQuery = computed(() => {
  const kind = kinds.value.find((entry) => entry.id === kindFilter.value)
  if (kind) {
    return kindQuery(kind)
  }
  // One accepted family is a server filter. Several are filtered here.
  if (props.accept?.length === 1) {
    const only = props.accept[0] as string
    return only === 'image/*' ? 'image' : only.replace(/\*$/, '')
  }
  return undefined
})

const visible = computed(() =>
  props.accept && !typeQuery.value
    ? items.value.filter((item) =>
        matchesMediaType(item.mimeType, props.accept)
      )
    : items.value
)

const filtered = computed(
  () => Boolean(search.value) || kindFilter.value !== 'all'
)

async function load(reset: boolean) {
  loading.value = true
  loadError.value = ''
  try {
    const result = await media.list({
      limit: PAGE_SIZE,
      offset: reset ? 0 : items.value.length,
      search: search.value.trim() || undefined,
      type: typeQuery.value,
      sort: sort.value,
    })
    items.value = reset ? result.data : [...items.value, ...result.data]
    total.value = result.total
  } catch (error) {
    loadError.value = errorText(error, 'pluto.media.loadFailed')
  } finally {
    loading.value = false
  }
}

watchDebounced(search, () => load(true), { debounce: 250 })
watch([kindFilter, sort], () => load(true))
onMounted(() => load(true))

const kindChips = computed(() => [
  { id: 'all', label: t('pluto.media.types.all'), icon: 'lucide:layout-grid' },
  ...(kinds.value.length > 1 ? kinds.value : []).map((kind) => ({
    id: kind.id,
    label: tx(kind.label),
    icon: kind.icon,
  })),
])

const sortItems = computed(() => [
  { label: t('pluto.media.sort.newest'), value: 'newest' },
  { label: t('pluto.media.sort.oldest'), value: 'oldest' },
  { label: t('pluto.media.sort.name'), value: 'name' },
  { label: t('pluto.media.sort.size'), value: 'size' },
])

function isSelected(item: PlutoMedia): boolean {
  return props.mode === 'select'
    ? selected.value.some((entry) => entry.id === item.id)
    : active.value?.id === item.id
}

function choose(item: PlutoMedia) {
  if (props.mode === 'manage') {
    active.value = active.value?.id === item.id ? null : item
    return
  }
  if (!props.multiple) {
    selected.value = isSelected(item) ? [] : [item]
    return
  }
  selected.value = isSelected(item)
    ? selected.value.filter((entry) => entry.id !== item.id)
    : [...selected.value, item]
}

function pickNow(item: PlutoMedia) {
  if (props.mode === 'select' && !props.multiple) {
    selected.value = [item]
    emit('confirm', item)
  }
}

// The check boxes of the Media page, for the bulk actions.
const checked = ref(new Set<string>())
function toggleCheck(id: string, on: boolean) {
  const next = new Set(checked.value)
  if (on) {
    next.add(id)
  } else {
    next.delete(id)
  }
  checked.value = next
}
const checkedItems = computed(() =>
  items.value.filter((item) => checked.value.has(item.id))
)
const allChecked = computed(
  () =>
    visible.value.length > 0 &&
    visible.value.every((item) => checked.value.has(item.id))
)
function checkAll(on: boolean) {
  checked.value = on ? new Set(visible.value.map((item) => item.id)) : new Set()
}

function absoluteUrl(url: string): string {
  return import.meta.client ? new URL(url, window.location.origin).href : url
}

const { copy } = useClipboard()
async function copyUrls() {
  await copy(checkedItems.value.map((item) => absoluteUrl(item.url)).join('\n'))
  toast.add({
    title: t('pluto.media.bulk.copied', { count: checkedItems.value.length }),
    color: 'success',
    icon: 'lucide:copy',
  })
}

const confirmDelete = ref(false)
const deleting = ref(false)
async function deleteChecked() {
  deleting.value = true
  const done: string[] = []
  for (const item of checkedItems.value) {
    try {
      await media.remove(item.id)
      done.push(item.id)
    } catch (error) {
      toast.add({
        title: t('pluto.media.errors.deleteFailed'),
        description: `${item.name}: ${errorText(error)}`,
        color: 'error',
      })
    }
  }
  deleting.value = false
  confirmDelete.value = false
  if (done.length) {
    drop(done)
    emit('deleted', done)
    toast.add({
      title: t('pluto.media.bulk.deleted', { count: done.length }),
      color: 'success',
      icon: 'lucide:trash',
    })
  }
}

// Uploads, one at a time, in the order of the files.
interface QueueEntry {
  key: number
  name: string
  progress: number
  /** A local image URL, for the thumbnail of the queue. */
  thumb?: string
  error?: string
}
const queue = ref<QueueEntry[]>([])
let nextKey = 0
const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)
let dragDepth = 0

function problemText(error: unknown, name: string): string {
  if (error instanceof PlutoMediaUploadProblem) {
    return t(error.key, error.params)
  }
  if (error instanceof PlutoMediaDecodeError) {
    return t('pluto.media.errors.decode', { name })
  }
  return errorText(error, 'pluto.media.upload.failed')
}

function forget(entry: QueueEntry) {
  if (entry.thumb) {
    URL.revokeObjectURL(entry.thumb)
  }
  queue.value = queue.value.filter((item) => item.key !== entry.key)
}

async function uploadFiles(files: File[]) {
  if (!canUpload.value || files.length === 0) {
    return
  }
  const entries = files.map((file) => ({
    file,
    entry: reactive<QueueEntry>({
      key: nextKey++,
      name: file.name,
      progress: 0,
      thumb: file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined,
    }),
  }))
  queue.value.push(...entries.map(({ entry }) => entry))
  let done = 0
  for (const { file, entry } of entries) {
    try {
      const record = await media.upload(file, {
        accept: props.accept,
        onProgress: (part) => {
          entry.progress = Math.round(part * 100)
        },
      })
      items.value = [record, ...items.value]
      total.value++
      done++
      forget(entry)
      if (props.mode === 'manage') {
        active.value = record
      } else if (props.multiple) {
        selected.value = [...selected.value, record]
      } else {
        selected.value = [record]
      }
    } catch (error) {
      entry.error = problemText(error, entry.name)
    }
  }
  if (done > 0) {
    toast.add({
      title: t('pluto.media.upload.done', { count: done }),
      color: 'success',
      icon: 'lucide:check',
    })
  }
}

function onPick(event: Event) {
  const target = event.target as HTMLInputElement
  uploadFiles([...(target.files ?? [])])
  target.value = ''
}

function onDragEnter() {
  dragDepth++
  dragging.value = canUpload.value
}
function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) {
    dragging.value = false
  }
}
function onDrop(event: DragEvent) {
  dragDepth = 0
  dragging.value = false
  uploadFiles([...(event.dataTransfer?.files ?? [])])
}

const acceptAttribute = computed(() =>
  mediaAcceptAttribute(props.accept ?? media.limits.allowedTypes)
)

const hint = computed(() =>
  t('pluto.media.upload.hint', {
    edge: PLUTO_MEDIA_MAX_IMAGE_EDGE,
    size: formatMediaSize(media.limits.maxUploadBytes, locale.value),
  })
)

function clearFilters() {
  search.value = ''
  kindFilter.value = 'all'
}

function pixels(item: PlutoMedia): string {
  const box = item.width ? item : item.preview
  return box?.width && box.height ? `${box.width} × ${box.height}` : ''
}

/** For the page: put a changed record in place, or take deleted ones out. */
function replace(record: PlutoMedia) {
  items.value = items.value.map((item) =>
    item.id === record.id ? record : item
  )
}
function drop(ids: string | string[]) {
  const gone = new Set(Array.isArray(ids) ? ids : [ids])
  items.value = items.value.filter((item) => !gone.has(item.id))
  total.value = Math.max(0, total.value - gone.size)
  checked.value = new Set([...checked.value].filter((id) => !gone.has(id)))
}
defineExpose({
  replace,
  drop,
  reload: () => load(true),
  upload: () => input.value?.click(),
})
</script>

<template>
  <div
    class="relative flex flex-col gap-4"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <!-- The toolbar: search, sort, view, upload. -->
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        :placeholder="t('pluto.media.search')"
        :aria-label="t('pluto.media.search')"
        icon="lucide:search"
        class="min-w-48 flex-1"
      />
      <USelect
        v-model="sort"
        :items="sortItems"
        :aria-label="t('pluto.media.sort.label')"
        icon="lucide:arrow-down-up"
        class="w-40"
      />
      <UFieldGroup>
        <UButton
          :aria-label="t('pluto.media.view.grid')"
          :aria-pressed="view === 'grid'"
          :variant="view === 'grid' ? 'soft' : 'ghost'"
          icon="lucide:layout-grid"
          color="neutral"
          @click="view = 'grid'"
        />
        <UButton
          :aria-label="t('pluto.media.view.list')"
          :aria-pressed="view === 'list'"
          :variant="view === 'list' ? 'soft' : 'ghost'"
          icon="lucide:list"
          color="neutral"
          @click="view = 'list'"
        />
      </UFieldGroup>
      <template v-if="canUpload">
        <UButton
          :label="t('pluto.media.upload.button')"
          icon="lucide:upload"
          @click="input?.click()"
        />
        <input
          ref="input"
          :accept="acceptAttribute"
          type="file"
          class="hidden"
          multiple
          @change="onPick"
        />
      </template>
    </div>

    <!-- The kinds of files. -->
    <div
      v-if="kindChips.length > 1"
      :aria-label="t('pluto.media.types.label')"
      role="group"
      class="flex flex-wrap gap-1.5"
    >
      <UButton
        v-for="chip in kindChips"
        :key="chip.id"
        :label="chip.label"
        :icon="chip.icon"
        :aria-pressed="kindFilter === chip.id"
        :variant="kindFilter === chip.id ? 'solid' : 'outline'"
        color="neutral"
        size="xs"
        class="rounded-full"
        @click="kindFilter = chip.id"
      />
    </div>

    <p v-if="canUpload" class="text-muted -mt-1 text-xs">
      {{ hint }}
    </p>

    <!-- The bulk actions of the Media page. -->
    <div
      v-if="mode === 'manage' && checked.size"
      class="bg-elevated ring-default flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ring"
    >
      <UCheckbox
        :model-value="allChecked"
        :label="t('pluto.media.bulk.selected', { count: checked.size })"
        @update:model-value="checkAll(Boolean($event))"
      />
      <div class="ms-auto flex flex-wrap gap-1.5">
        <UButton
          :label="t('pluto.media.bulk.copyUrls')"
          icon="lucide:copy"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="copyUrls"
        />
        <UButton
          v-if="canDelete"
          :label="t('pluto.media.bulk.delete')"
          icon="lucide:trash"
          color="error"
          variant="soft"
          size="sm"
          @click="confirmDelete = true"
        />
        <UButton
          :label="t('pluto.media.bulk.clear')"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="checkAll(false)"
        />
      </div>
    </div>

    <!-- The upload queue. -->
    <ul v-if="queue.length" class="grid gap-2 sm:grid-cols-2">
      <li
        v-for="entry in queue"
        :key="entry.key"
        class="bg-elevated ring-default flex items-center gap-3 rounded-lg p-2 ring"
      >
        <div
          class="bg-default flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md"
        >
          <img
            v-if="entry.thumb"
            :src="entry.thumb"
            alt=""
            class="size-full object-cover"
          />
          <UIcon v-else name="lucide:file" class="text-muted size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ entry.name }}</p>
          <p v-if="entry.error" class="text-error text-xs">
            {{ entry.error }}
          </p>
          <UProgress
            v-else
            :model-value="entry.progress || null"
            size="xs"
            class="mt-1.5"
          />
        </div>
        <UButton
          v-if="entry.error"
          :aria-label="t('pluto.common.close')"
          icon="lucide:x"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="forget(entry)"
        />
      </li>
    </ul>

    <UAlert
      v-if="loadError"
      :title="t('pluto.media.loadFailed')"
      :description="loadError"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <!-- Empty: no files yet, or no match. -->
    <div
      v-else-if="!loading && visible.length === 0"
      class="border-default flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center"
    >
      <div
        class="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full"
      >
        <UIcon
          :name="filtered ? 'lucide:search-x' : 'lucide:images'"
          class="size-6"
        />
      </div>
      <p class="font-medium">
        {{ filtered ? t('pluto.media.noResults') : t('pluto.media.empty') }}
      </p>
      <p v-if="!filtered" class="text-muted max-w-sm text-sm text-pretty">
        {{ canUpload ? t('pluto.media.dropHint') : t('pluto.media.emptyHint') }}
      </p>
      <UButton
        v-if="filtered"
        :label="t('pluto.media.clear')"
        color="neutral"
        variant="outline"
        @click="clearFilters"
      />
      <UButton
        v-else-if="canUpload"
        :label="t('pluto.media.upload.button')"
        icon="lucide:upload"
        @click="input?.click()"
      />
    </div>

    <!-- The grid. -->
    <div
      v-else-if="view === 'grid'"
      class="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3"
    >
      <div v-for="item in visible" :key="item.id" class="group/tile relative">
        <button
          :aria-pressed="isSelected(item)"
          :aria-label="item.alt || item.name"
          :title="item.name"
          type="button"
          class="focus-visible:outline-primary block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="choose(item)"
          @dblclick="pickNow(item)"
        >
          <PlutoMediaTile :media="item" :selected="isSelected(item)" details />
        </button>
        <UCheckbox
          v-if="mode === 'manage'"
          :model-value="checked.has(item.id)"
          :aria-label="item.name"
          :class="
            checked.size
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100'
          "
          class="bg-default/80 absolute top-1.5 left-1.5 rounded p-1 transition-opacity"
          @update:model-value="toggleCheck(item.id, Boolean($event))"
        />
      </div>

      <template v-if="loading">
        <USkeleton
          v-for="index in items.length ? 4 : 12"
          :key="`skeleton-${index}`"
          class="aspect-square rounded-lg"
        />
      </template>
    </div>

    <!-- The list. -->
    <div v-else class="ring-default overflow-x-auto rounded-lg ring">
      <table class="w-full text-sm">
        <thead class="bg-elevated text-muted text-left text-xs">
          <tr>
            <th v-if="mode === 'manage'" class="w-10 px-3 py-2">
              <UCheckbox
                :model-value="allChecked"
                :aria-label="t('pluto.media.bulk.all')"
                @update:model-value="checkAll(Boolean($event))"
              />
            </th>
            <th class="px-3 py-2 font-medium">
              {{ t('pluto.media.details.name') }}
            </th>
            <th class="hidden px-3 py-2 font-medium sm:table-cell">
              {{ t('pluto.media.details.type') }}
            </th>
            <th class="px-3 py-2 text-right font-medium">
              {{ t('pluto.media.details.size') }}
            </th>
            <th class="hidden px-3 py-2 text-right font-medium md:table-cell">
              {{ t('pluto.media.details.pixels') }}
            </th>
            <th class="hidden px-3 py-2 text-right font-medium lg:table-cell">
              {{ t('pluto.media.details.date') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-default divide-y">
          <tr
            v-for="item in visible"
            :key="item.id"
            :class="isSelected(item) ? 'bg-primary/5' : 'hover:bg-elevated/60'"
            class="cursor-pointer"
            @click="choose(item)"
            @dblclick="pickNow(item)"
          >
            <td v-if="mode === 'manage'" class="px-3 py-2" @click.stop>
              <UCheckbox
                :model-value="checked.has(item.id)"
                :aria-label="item.name"
                @update:model-value="toggleCheck(item.id, Boolean($event))"
              />
            </td>
            <td class="px-3 py-2">
              <div class="flex min-w-0 items-center gap-3">
                <PlutoMediaTile
                  :media="item"
                  class="size-10 shrink-0"
                  compact
                />
                <button
                  :aria-pressed="isSelected(item)"
                  type="button"
                  class="truncate text-left font-medium"
                >
                  {{ item.name }}
                </button>
              </div>
            </td>
            <td class="text-muted hidden px-3 py-2 sm:table-cell">
              {{
                tx(media.kinds.kindOf(item.mimeType)?.label ?? item.mimeType)
              }}
            </td>
            <td class="text-muted px-3 py-2 text-right whitespace-nowrap">
              {{ formatMediaSize(item.size, locale) }}
            </td>
            <td
              class="text-muted hidden px-3 py-2 text-right whitespace-nowrap md:table-cell"
            >
              {{ pixels(item) }}
            </td>
            <td
              class="text-muted hidden px-3 py-2 text-right whitespace-nowrap lg:table-cell"
            >
              {{ d(new Date(item.createdAt), { dateStyle: 'medium' }) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="items.length"
      class="text-muted flex items-center justify-between gap-3 text-sm"
    >
      <span>{{ t('pluto.media.count', { shown: items.length, total }) }}</span>
      <UButton
        v-if="items.length < total"
        :label="t('pluto.media.loadMore')"
        :loading="loading"
        color="neutral"
        variant="outline"
        size="sm"
        @click="load(false)"
      />
    </div>

    <div
      v-if="dragging"
      class="border-primary bg-primary/10 text-primary pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium"
    >
      <UIcon name="lucide:upload" class="size-8" />
      {{ t('pluto.media.upload.drop') }}
    </div>

    <UModal
      v-model:open="confirmDelete"
      :title="t('pluto.media.bulk.delete')"
      :description="
        t('pluto.media.bulk.deleteConfirm', { count: checked.size })
      "
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            :label="t('pluto.common.cancel')"
            color="neutral"
            variant="ghost"
            @click="confirmDelete = false"
          />
          <UButton
            :label="t('pluto.common.delete')"
            :loading="deleting"
            color="error"
            @click="deleteChecked"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
