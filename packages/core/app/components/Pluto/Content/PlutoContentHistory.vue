<script setup lang="ts">
// A toolbar item of the edit form (`contentToolbarItems`, every content type). It shows History
// when the backend keeps revisions (`adapter.listRevisions`) and the item has one. The
// slideover lists the saved versions, newest first, and shows what a restore of one changes in
// the form. "Restore this version" copies its fields into the form (`revisionRestoreValues`: not
// the slug, not the status). The user then saves, so a restore is a normal save: validation,
// capabilities, the conflict check, and a new version that can be undone. See the content-model
// skill ("Revisions").

const { t, d } = usePlutoI18n()
const form = usePlutoContentForm()
const toast = useToast()

/** Revisions per page. */
const PAGE = 20

const revisions = ref<PlutoContentRevision[]>([])
const nextCursor = ref<string>()
const supported = ref(false)
const loading = ref(false)
const loadError = ref(false)
const open = ref(false)

const type = computed(() => form?.type.value)
const text = usePlutoContentText(type)
const isDesktop = useMediaQuery('(min-width: 48rem)')
const itemId = computed(() => {
  const id = form?.item.value.id
  return id === undefined || id === null || id === '' ? undefined : String(id)
})

async function load(more = false) {
  if (!form?.editing.value || !type.value || !itemId.value) {
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const page = await $fetch<PlutoContentRevisionList>(
      `/api/_pluto/content-revisions/${type.value.name}/${contentIdPath(itemId.value)}`,
      {
        query: {
          limit: PAGE,
          ...(more && nextCursor.value ? { cursor: nextCursor.value } : {}),
        },
      }
    )
    supported.value = page.supported
    revisions.value = more ? [...revisions.value, ...page.data] : page.data
    nextCursor.value = page.nextCursor
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// --- The selected version --------------------------------------------------

const selectedId = ref<string>()
const selectedItem = ref<PlutoContentItem | null>(null)
const selectedLoading = ref(false)
const selectedError = ref(false)
// A revision never changes, so its item is read once.
const revisionCache = new Map<string, PlutoContentItem>()

async function select(revision: PlutoContentRevision) {
  selectedId.value = revision.id
  selectedError.value = false
  const cached = revisionCache.get(revision.id)
  if (cached) {
    selectedItem.value = cached
    return
  }
  selectedItem.value = null
  if (!type.value || !itemId.value) {
    return
  }
  selectedLoading.value = true
  try {
    const item = await $fetch<PlutoContentItem>(
      `/api/_pluto/content-revision/${type.value.name}/${encodeURIComponent(revision.id)}/${contentIdPath(itemId.value)}`
    )
    revisionCache.set(revision.id, item)
    if (selectedId.value === revision.id) {
      selectedItem.value = item
    }
  } catch {
    if (selectedId.value === revision.id) {
      selectedError.value = true
    }
  } finally {
    if (selectedId.value === revision.id) {
      selectedLoading.value = false
    }
  }
}

// The first page loads when the edit page opens, so the button shows only when there is a
// history. A save adds a version: read the list again.
onMounted(() => load())
form?.onSaved(() => {
  selectedId.value = undefined
  load()
})

// On open: the version before the current one, or the current one when the form has unsaved
// changes (a restore of it drops them).
watch(open, (value) => {
  if (!value || selectedId.value) {
    return
  }
  const first = form?.dirty.value ? revisions.value[0] : revisions.value[1]
  const pick = first ?? revisions.value[0]
  if (pick && isDesktop.value) {
    select(pick)
  }
})

const changes = computed(() =>
  type.value && form && selectedItem.value
    ? diffRevision(type.value, form.item.value, selectedItem.value)
    : []
)

function restore() {
  if (!form || !type.value || !selectedItem.value) {
    return
  }
  form.item.value = {
    ...form.item.value,
    ...revisionRestoreValues(type.value, selectedItem.value),
  }
  open.value = false
  toast.add({
    title: t('pluto.history.restored'),
    description: t('pluto.history.restoredHint'),
    color: 'success',
    icon: 'lucide:history',
  })
}

// --- Labels ------------------------------------------------------------------

function titleOf(revision: PlutoContentRevision): string {
  return revision.action
    ? t(`pluto.history.actions.${revision.action}`)
    : revision.message || t('pluto.history.actions.update')
}

function timeOf(revision: PlutoContentRevision): string {
  return d(revision.createdAt, { dateStyle: 'medium', timeStyle: 'short' })
}

const selectedRevision = computed(() =>
  revisions.value.find((revision) => revision.id === selectedId.value)
)
</script>

<template>
  <USlideover
    v-if="supported && revisions.length > 0"
    v-model:open="open"
    :title="t('pluto.history.title')"
    :description="t('pluto.history.description')"
    :ui="{ content: 'sm:max-w-4xl', body: 'p-0 sm:p-0' }"
    side="right"
  >
    <UTooltip :text="t('pluto.history.button')">
      <UButton
        :aria-label="t('pluto.history.button')"
        icon="lucide:history"
        color="neutral"
        variant="ghost"
        square
      />
    </UTooltip>

    <template #body>
      <div class="flex h-full min-h-0">
        <!-- The versions. On a narrow screen they hide while a version is open. -->
        <nav
          v-if="isDesktop || !selectedId"
          :aria-label="t('pluto.history.title')"
          class="border-default flex min-h-0 w-full shrink-0 flex-col overflow-y-auto md:w-72 md:border-e"
        >
          <ul class="p-2">
            <li v-for="(revision, index) in revisions" :key="revision.id">
              <button
                :aria-current="revision.id === selectedId ? 'true' : undefined"
                :class="revision.id === selectedId ? 'bg-elevated' : ''"
                type="button"
                class="hover:bg-elevated/60 focus-visible:ring-primary flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-start focus-visible:ring-2 focus-visible:outline-none"
                @click="select(revision)"
              >
                <UAvatar
                  :src="revision.author?.avatarUrl"
                  :alt="revision.author?.name || t('pluto.history.unknownAuthor')"
                  size="sm"
                  class="mt-0.5 shrink-0"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="text-highlighted truncate text-sm font-medium">
                      {{ titleOf(revision) }}
                    </span>
                    <UBadge
                      v-if="index === 0"
                      :label="t('pluto.history.current')"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    />
                  </span>
                  <span class="text-muted block truncate text-xs">
                    {{ revision.author?.name || t('pluto.history.unknownAuthor') }}
                    · {{ timeOf(revision) }}
                  </span>
                </span>
              </button>
            </li>
          </ul>

          <div class="px-4 pb-4">
            <UButton
              v-if="nextCursor"
              :label="t('pluto.history.loadMore')"
              :loading="loading"
              color="neutral"
              variant="outline"
              size="sm"
              block
              @click="load(true)"
            />
            <p v-if="loadError" class="text-error mt-2 text-xs">
              {{ t('pluto.history.loadError') }}
            </p>
          </div>
        </nav>

        <!-- What a restore of the selected version changes in the form. -->
        <section
          v-if="isDesktop || selectedId"
          class="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div
            v-if="!selectedId"
            class="text-muted flex flex-1 items-center justify-center p-6 text-center text-sm"
          >
            {{ t('pluto.history.pick') }}
          </div>

          <template v-else>
            <div
              class="border-default flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3"
            >
              <UButton
                v-if="!isDesktop"
                :aria-label="t('pluto.history.back')"
                icon="lucide:arrow-left"
                color="neutral"
                variant="ghost"
                size="sm"
                square
                @click="selectedId = undefined"
              />
              <div class="min-w-0 flex-1">
                <p
                  v-if="selectedRevision"
                  class="text-highlighted truncate text-sm font-medium"
                >
                  {{ titleOf(selectedRevision) }} · {{ timeOf(selectedRevision) }}
                </p>
                <p v-if="selectedItem" class="text-muted text-xs">
                  {{ t('pluto.history.changes', changes.length) }}
                </p>
              </div>
              <UButton
                :label="t('pluto.history.restore')"
                :disabled="!selectedItem || changes.length === 0"
                icon="lucide:rotate-ccw"
                @click="restore"
              />
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto p-4">
              <div
                v-if="selectedLoading"
                class="flex flex-col gap-3"
                aria-busy="true"
              >
                <USkeleton class="h-4 w-40" />
                <USkeleton class="h-24 w-full" />
              </div>

              <UAlert
                v-else-if="selectedError"
                :title="t('pluto.history.versionError')"
                color="error"
                variant="subtle"
                icon="lucide:circle-alert"
              />

              <p
                v-else-if="selectedItem && changes.length === 0"
                class="text-muted text-sm"
              >
                {{ t('pluto.history.same') }}
              </p>

              <div v-else-if="selectedItem" class="flex flex-col gap-5">
                <p class="text-muted text-xs">
                  {{ t('pluto.history.restoreHint') }}
                </p>

                <section
                  v-for="change in changes"
                  :key="change.field.name"
                  class="flex flex-col gap-1.5"
                >
                  <h3 class="text-highlighted text-sm font-medium">
                    {{ text.fieldLabel(change.field) }}
                  </h3>

                  <dl
                    v-if="change.kind === 'value'"
                    class="border-default divide-default divide-y overflow-hidden rounded-md border text-sm"
                  >
                    <div class="bg-error/5 flex gap-3 px-3 py-2">
                      <dt class="text-muted w-24 shrink-0 text-xs/5">
                        {{ t('pluto.history.now') }}
                      </dt>
                      <dd class="text-default min-w-0 wrap-break-word">
                        {{ change.before || t('pluto.history.empty') }}
                      </dd>
                    </div>
                    <div class="bg-success/5 flex gap-3 px-3 py-2">
                      <dt class="text-muted w-24 shrink-0 text-xs/5">
                        {{ t('pluto.history.version') }}
                      </dt>
                      <dd class="text-highlighted min-w-0 wrap-break-word">
                        {{ change.after || t('pluto.history.empty') }}
                      </dd>
                    </div>
                  </dl>

                  <div
                    v-else
                    class="border-default overflow-x-auto rounded-md border font-mono text-xs/5"
                  >
                    <template
                      v-for="(row, index) in foldDiff(change.lines)"
                      :key="index"
                    >
                      <div
                        v-if="row.kind === 'skip'"
                        class="bg-elevated/50 text-muted px-3 py-0.5 font-sans"
                      >
                        {{ t('pluto.history.hiddenLines', row.count) }}
                      </div>
                      <div
                        v-else
                        :class="
                          row.kind === 'add'
                            ? 'bg-success/10 text-highlighted'
                            : row.kind === 'remove'
                              ? 'bg-error/10 text-default'
                              : 'text-muted'
                        "
                        class="flex min-w-max"
                      >
                        <span
                          class="w-6 shrink-0 text-center select-none"
                          aria-hidden="true"
                          >{{
                            row.kind === 'add'
                              ? '+'
                              : row.kind === 'remove'
                                ? '−'
                                : ''
                          }}</span
                        >
                        <span class="sr-only">{{
                          row.kind === 'add'
                            ? t('pluto.history.version')
                            : row.kind === 'remove'
                              ? t('pluto.history.now')
                              : ''
                        }}</span>
                        <span class="pe-3 whitespace-pre">{{
                          row.text || ' '
                        }}</span>
                      </div>
                    </template>
                  </div>
                </section>
              </div>
            </div>
          </template>
        </section>
      </div>
    </template>
  </USlideover>
</template>
