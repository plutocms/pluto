<script setup lang="ts">
import { runInBatches } from '../../../composables/internal/bulk-actions'
import {
  purgePlutoTrashItem,
  restorePlutoTrashItem,
} from '../../../composables/pluto-content-trash'

// The Trash tab of a list: the trashed items of one type, the last trashed first, with Restore
// and Delete forever (one item or the selected ones), and Empty the trash. A row list, not a
// table, so it is the same on a phone. See the content-model skill ("Trash").
const props = defineProps<{
  type: string
}>()

const emit = defineEmits<{
  /** The trash changed: the count of the tab must load again. */
  changed: []
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))
const text = usePlutoContentText(contentType)
const { t, n, locale } = usePlutoI18n()
const toast = useToast()
const errorText = usePlutoErrorText()

const searchText = ref('')
const search = refDebounced(searchText, 300)
const { items, total, pending, error, refresh, empty } = usePlutoContentTrash(
  props.type,
  { search }
)

function itemTitle(item: PlutoContentItem): string {
  const value = item[contentType.value?.titleField ?? '']
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

const dateFormat = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
)

function deletedText(item: PlutoContentItem): string {
  const value = item._deletedAt
  return typeof value === 'string'
    ? t('pluto.list.trash.deletedAt', {
        date: dateFormat.value.format(new Date(value)),
      })
    : ''
}

const selected = ref<Set<string>>(new Set())
const selectedItems = computed(() =>
  items.value.filter((item) => selected.value.has(String(item.id)))
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

function clearSelection() {
  selected.value = new Set()
}

watch(search, clearSelection)

const busy = ref(false)

async function afterChange() {
  clearSelection()
  emit('changed')
  await refresh().catch(() => {})
}

/** Restores the items, 4 at a time, and shows one toast. */
async function restoreItems(ids: Array<string | number>) {
  busy.value = true
  try {
    let firstError: unknown
    const { done, failed } = await runInBatches(ids, async (id) => {
      try {
        await restorePlutoTrashItem(props.type, id)
      } catch (caught) {
        firstError ??= caught
        throw caught
      }
    })
    toast.add({
      title: t('pluto.list.trash.restoredMany', { count: n(done) }),
      description: failed
        ? errorText(firstError, 'pluto.list.trash.restoreError')
        : undefined,
      color: failed ? 'warning' : 'success',
    })
  } finally {
    busy.value = false
    await afterChange()
  }
}

// Delete forever and Empty the trash ask first: they cannot be undone.
const confirm = ref<null | {
  kind: 'purge' | 'empty'
  ids: Array<string | number>
}>(null)
const confirmOpen = computed({
  get: () => confirm.value !== null,
  set: (open: boolean) => {
    if (!open && !busy.value) {
      confirm.value = null
    }
  },
})

const confirmText = computed(() => {
  const value = confirm.value
  if (!value) {
    return ''
  }
  if (value.kind === 'empty') {
    return t('pluto.list.trash.emptyConfirm', { count: n(total.value) })
  }
  return value.ids.length === 1
    ? t('pluto.list.trash.purgeConfirm')
    : t('pluto.list.trash.purgeManyConfirm', { count: n(value.ids.length) })
})

async function runConfirm() {
  const value = confirm.value
  if (!value || busy.value) {
    return
  }
  busy.value = true
  try {
    if (value.kind === 'empty') {
      const purged = await empty()
      toast.add({
        title: t('pluto.list.trash.purgedMany', { count: n(purged) }),
        color: 'success',
      })
    } else {
      const { done, failed } = await runInBatches(value.ids, (id) =>
        purgePlutoTrashItem(props.type, id)
      )
      toast.add({
        title: t('pluto.list.trash.purgedMany', { count: n(done) }),
        description: failed
          ? t('pluto.list.bulk.failed', { count: n(failed) })
          : undefined,
        color: failed ? 'warning' : 'success',
      })
    }
  } catch (caught) {
    toast.add({
      title: t('pluto.common.error'),
      description: errorText(caught, 'pluto.list.trash.purgeError'),
      color: 'error',
    })
  } finally {
    busy.value = false
    confirm.value = null
    await afterChange()
  }
}

defineExpose({ refresh })
</script>

<template>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <UInput
        v-model="searchText"
        :placeholder="
          t('pluto.list.trash.search', { labelPlural: text.labelPluralLower })
        "
        :aria-label="
          t('pluto.list.trash.search', { labelPlural: text.labelPluralLower })
        "
        icon="lucide:search"
        class="min-w-48 flex-1"
      />
      <UButton
        v-if="total > 0"
        :label="t('pluto.list.trash.empty')"
        :disabled="busy"
        icon="lucide:trash-2"
        color="error"
        variant="soft"
        @click="confirm = { kind: 'empty', ids: [] }"
      />
    </div>

    <p class="text-muted -mt-1 shrink-0 text-xs">
      {{ t('pluto.list.trash.note') }}
    </p>

    <!-- The selected rows. -->
    <div
      v-if="selectedItems.length > 0"
      class="bg-elevated flex shrink-0 flex-wrap items-center gap-2 rounded-lg px-3 py-1.5"
    >
      <span class="text-highlighted me-2 text-sm font-medium tabular-nums">
        {{ t('pluto.list.bulk.selected', { count: n(selectedItems.length) }) }}
      </span>
      <UButton
        :label="t('pluto.list.trash.restore')"
        :disabled="busy"
        icon="lucide:undo-2"
        color="neutral"
        variant="outline"
        size="sm"
        @click="restoreItems(selectedItems.map((item) => item.id))"
      />
      <UButton
        :label="t('pluto.list.trash.purge')"
        :disabled="busy"
        icon="lucide:trash-2"
        color="error"
        variant="soft"
        size="sm"
        @click="
          confirm = {
            kind: 'purge',
            ids: selectedItems.map((item) => item.id),
          }
        "
      />
      <UButton
        :label="t('pluto.list.bulk.clear')"
        :disabled="busy"
        icon="lucide:x"
        color="neutral"
        variant="ghost"
        size="sm"
        class="ms-auto"
        @click="clearSelection"
      />
    </div>

    <UAlert
      v-if="error"
      :title="t('pluto.list.trash.loadFailed')"
      :description="errorText(error, 'pluto.list.loadFailedHint')"
      :actions="[
        {
          label: t('pluto.common.tryAgain'),
          color: 'error',
          variant: 'outline',
          onClick: () => refresh().catch(() => {}),
        },
      ]"
      color="error"
      variant="subtle"
      icon="lucide:circle-alert"
    />

    <UEmpty
      v-else-if="!pending && items.length === 0"
      :title="
        searchText.trim()
          ? t('pluto.list.noMatch', { labelPlural: text.labelPluralLower })
          : t('pluto.list.trash.emptyTitle')
      "
      :description="
        searchText.trim()
          ? t('pluto.list.noMatchHint')
          : t('pluto.list.trash.emptyHint')
      "
      icon="lucide:trash-2"
      variant="naked"
    />

    <ul
      v-else-if="items.length > 0"
      :aria-busy="pending"
      class="ring-default divide-default min-h-0 divide-y overflow-y-auto rounded-lg ring"
    >
      <li
        v-for="item in items"
        :key="item.id"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
      >
        <UCheckbox
          :model-value="selected.has(String(item.id))"
          :aria-label="
            t('pluto.list.bulk.selectRow', {
              title: itemTitle(item) || t('pluto.content.untitled'),
            })
          "
          @update:model-value="(value) => toggleRow(item.id, value === true)"
        />
        <div class="min-w-0 flex-1">
          <p
            :class="itemTitle(item) ? 'text-highlighted' : 'text-muted italic'"
            class="truncate font-medium"
          >
            {{ itemTitle(item) || t('pluto.content.untitled') }}
          </p>
          <p class="text-muted text-xs">{{ deletedText(item) }}</p>
        </div>
        <div class="flex gap-2">
          <UButton
            :label="t('pluto.list.trash.restore')"
            :disabled="busy"
            icon="lucide:undo-2"
            color="neutral"
            variant="outline"
            size="sm"
            @click="restoreItems([item.id])"
          />
          <UButton
            :label="t('pluto.list.trash.purge')"
            :disabled="busy"
            icon="lucide:trash-2"
            color="error"
            variant="ghost"
            size="sm"
            @click="confirm = { kind: 'purge', ids: [item.id] }"
          />
        </div>
      </li>
    </ul>

    <p
      v-if="total > items.length"
      class="text-muted shrink-0 text-xs tabular-nums"
    >
      {{
        t('pluto.list.showingOf', {
          loaded: n(items.length),
          total: n(total),
          labelPlural: text.labelPluralLower,
        })
      }}
    </p>
  </div>

  <Modal v-model="confirmOpen" :custom-size="480">
    <ModalHeader @close="confirmOpen = false">
      {{
        confirm?.kind === 'empty'
          ? t('pluto.list.trash.empty')
          : t('pluto.list.trash.purge')
      }}
    </ModalHeader>

    <ModalContent>
      <p>{{ confirmText }}</p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          :disabled="busy"
          icon="lucide:x"
          variant="ghost"
          color="neutral"
          @click="confirmOpen = false"
        >
          {{ t('pluto.common.cancel') }}
        </UButton>
        <UButton
          :loading="busy"
          icon="lucide:trash-2"
          color="error"
          @click="runConfirm"
        >
          {{
            confirm?.kind === 'empty'
              ? t('pluto.list.trash.empty')
              : t('pluto.list.trash.purge')
          }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
