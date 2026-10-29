<script setup lang="ts">
// The media grid: search, a type filter, uploads (a button, or drop files on
// the grid) and "Show more". Two modes:
// - `manage` (the Media page): a click makes a file `active`, for the details panel.
// - `select` (the picker): a click selects a file (`selected`), one or many.
// See the media skill.
import type { PlutoMedia } from '../../../../shared/types/media'
import {
  formatMediaSize,
  matchesMediaType,
  mediaAcceptAttribute,
  PLUTO_MEDIA_MAX_IMAGE_EDGE,
} from '../../../../shared/utils/media'
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

const selected = defineModel<PlutoMedia[]>('selected', { default: () => [] })
const active = defineModel<PlutoMedia | null>('active', { default: null })

const PAGE_SIZE = 40

const { t, locale } = usePlutoI18n()
const errorText = usePlutoErrorText()
const { can } = usePlutoPermissions()
const media = usePlutoMedia()

const canUpload = computed(() => can('media:manage'))

const items = ref<PlutoMedia[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const search = ref('')
// `all`, `image`, or a MIME prefix. A select item cannot have an empty value.
const typeFilter = ref('all')
const filtered = computed(
  () => Boolean(search.value) || typeFilter.value !== 'all'
)

// One accepted family is a server filter. Several are filtered here.
const fixedType = computed(() => {
  if (props.accept?.length !== 1) {
    return undefined
  }
  const only = props.accept[0] as string
  return only === 'image/*' ? 'image' : only.replace(/\*$/, '')
})

// Each filter, with one type of its family, to test it against `accept`.
const typeItems = computed(() =>
  [
    { label: t('pluto.media.types.all'), value: 'all', sample: '' },
    {
      label: t('pluto.media.types.image'),
      value: 'image',
      sample: 'image/webp',
    },
    {
      label: t('pluto.media.types.model'),
      value: 'model/',
      sample: 'model/gltf-binary',
    },
    {
      label: t('pluto.media.types.document'),
      value: 'application/pdf',
      sample: 'application/pdf',
    },
  ].filter(
    (item) => !item.sample || matchesMediaType(item.sample, props.accept)
  )
)

const visible = computed(() =>
  props.accept && !fixedType.value
    ? items.value.filter((item) =>
        matchesMediaType(item.mimeType, props.accept)
      )
    : items.value
)

async function load(reset: boolean) {
  loading.value = true
  loadError.value = ''
  try {
    const result = await media.list({
      limit: PAGE_SIZE,
      offset: reset ? 0 : items.value.length,
      search: search.value.trim() || undefined,
      type:
        fixedType.value ??
        (typeFilter.value === 'all' ? undefined : typeFilter.value),
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
watch(typeFilter, () => load(true))
onMounted(() => load(true))

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

// Uploads, one at a time, in the order of the files.
interface QueueEntry {
  key: number
  name: string
  error?: string
}
const queue = ref<QueueEntry[]>([])
let nextKey = 0
const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)
const toast = useToast()

function problemText(error: unknown, name: string): string {
  if (error instanceof PlutoMediaUploadProblem) {
    return t(error.key, error.params)
  }
  if (error instanceof PlutoMediaDecodeError) {
    return t('pluto.media.errors.decode', { name })
  }
  return errorText(error, 'pluto.media.upload.failed')
}

async function uploadFiles(files: File[]) {
  if (!canUpload.value || files.length === 0) {
    return
  }
  const entries = files.map((file) => ({
    key: nextKey++,
    name: file.name,
    file,
  }))
  queue.value.push(...entries.map(({ key, name }) => ({ key, name })))
  let done = 0
  for (const entry of entries) {
    try {
      const record = await media.upload(entry.file, { accept: props.accept })
      items.value = [record, ...items.value]
      total.value++
      done++
      queue.value = queue.value.filter((item) => item.key !== entry.key)
      if (props.mode === 'manage') {
        active.value = record
      } else if (props.multiple) {
        selected.value = [...selected.value, record]
      } else {
        selected.value = [record]
      }
    } catch (error) {
      const failed = queue.value.find((item) => item.key === entry.key)
      if (failed) {
        failed.error = problemText(error, entry.name)
      }
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

function onDrop(event: DragEvent) {
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
  typeFilter.value = 'all'
}

/** For the page: put a changed record in place, or take a deleted one out. */
function replace(record: PlutoMedia) {
  items.value = items.value.map((item) =>
    item.id === record.id ? record : item
  )
}
function drop(id: string) {
  items.value = items.value.filter((item) => item.id !== id)
  total.value = Math.max(0, total.value - 1)
}
defineExpose({ replace, drop, reload: () => load(true) })
</script>

<template>
  <div
    class="relative flex flex-col gap-4"
    @dragover.prevent="dragging = canUpload"
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        :placeholder="t('pluto.media.search')"
        :aria-label="t('pluto.media.search')"
        icon="lucide:search"
        class="min-w-48 flex-1"
      />
      <USelect
        v-if="!fixedType && typeItems.length > 2"
        v-model="typeFilter"
        :items="typeItems"
        :aria-label="t('pluto.media.types.all')"
        class="w-40"
      />
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

    <p v-if="canUpload" class="text-muted -mt-2 text-xs">
      {{ hint }}
    </p>

    <ul v-if="queue.length" class="flex flex-col gap-2">
      <li v-for="entry in queue" :key="entry.key">
        <UAlert
          v-if="entry.error"
          :title="entry.name"
          :description="entry.error"
          color="error"
          variant="subtle"
          icon="lucide:circle-alert"
          close
          @update:open="queue = queue.filter((item) => item.key !== entry.key)"
        />
        <div v-else class="text-muted flex items-center gap-2 text-sm">
          <UIcon name="lucide:loader-circle" class="size-4 animate-spin" />
          {{ t('pluto.media.upload.working', { name: entry.name }) }}
        </div>
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

    <UEmpty
      v-else-if="!loading && visible.length === 0"
      :title="filtered ? t('pluto.media.noResults') : t('pluto.media.empty')"
      :description="filtered ? undefined : t('pluto.media.emptyHint')"
      :actions="
        filtered
          ? [
              {
                label: t('pluto.media.clear'),
                color: 'neutral',
                variant: 'outline',
                onClick: clearFilters,
              },
            ]
          : canUpload
            ? [
                {
                  label: t('pluto.media.upload.button'),
                  icon: 'lucide:upload',
                  onClick: () => input?.click(),
                },
              ]
            : []
      "
      icon="lucide:images"
      variant="naked"
    />

    <div
      v-else
      class="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3"
    >
      <button
        v-for="item in visible"
        :key="item.id"
        :aria-pressed="isSelected(item)"
        :aria-label="item.alt || item.name"
        :title="item.name"
        type="button"
        class="group/tile focus-visible:outline-primary rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        @click="choose(item)"
      >
        <PlutoMediaTile :media="item" :selected="isSelected(item)" />
      </button>

      <template v-if="loading">
        <USkeleton
          v-for="index in items.length ? 4 : 12"
          :key="`skeleton-${index}`"
          class="aspect-square rounded-lg"
        />
      </template>
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
      class="border-primary bg-primary/10 text-primary pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed text-sm font-medium"
    >
      {{ t('pluto.media.upload.drop') }}
    </div>
  </div>
</template>
