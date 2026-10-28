<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { RouteLocationNormalized } from 'vue-router'
import type { DirtyState } from '../../../composables/internal/content-dirty'
import {
  createDirtyTracker,
  isEditingEvent,
  isSaveShortcut,
  savedAgo,
  stableStringify,
} from '../../../composables/internal/content-dirty'
import { buildContentPayload } from '../../../composables/internal/content-payload'

const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
  /** Present in edit mode. Absent in "new entry" mode. */
  id?: string | number
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))
const { t, tx, locale } = usePlutoI18n()
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

// The save state next to the title. `failed` stays until the next save starts.
const saveStatus = ref<'idle' | 'saved' | 'failed'>('idle')
const savedAt = ref<Date | null>(null)
// The status of the last save, so a retry repeats the same save (for example Publish).
let lastStatusOverride: string | undefined

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

// --- Unsaved changes ---------------------------------------------------------
//
// The item is dirty when the payload differs from the baseline. The baseline
// follows the item until the user first edits, so a widget that normalizes its
// value after it mounts (an editor, for example) does not make the form dirty.
// A save sets a new baseline. See `createDirtyTracker`.
const dirtyState = reactive<DirtyState>({ baseline: null })
const tracker = createDirtyTracker(dirtyState)
const snapshot = computed(() => stableStringify(buildContentPayload(contentType.value, item.value)))
watch(snapshot, (value) => tracker.follow(value), { immediate: true })

const dirty = computed(() => !itemPending.value && !loadFailed.value && tracker.isDirty(snapshot.value))

// A key press, a paste, a drop, or a press on a control counts as an edit. The
// load must end first: an input during the load does not freeze the baseline.
useEventListener(
  import.meta.client ? document : undefined,
  ['keydown', 'input', 'change', 'paste', 'drop', 'pointerdown'],
  (event: Event) => {
    if (!itemPending.value && isEditingEvent(event.type, event.target as Element | null)) {
      tracker.interact()
    }
  },
  { capture: true }
)

const saveState = computed<PlutoSaveState>(() => {
  if (saving.value) {
    return 'saving'
  }
  if (saveStatus.value === 'failed' && dirty.value) {
    return 'failed'
  }
  if (dirty.value) {
    return 'dirty'
  }
  return saveStatus.value === 'saved' ? 'saved' : 'idle'
})

// "Saved 2 minutes ago". The clock ticks every 30 seconds.
const now = useNow({ interval: 30_000 })
const savedText = computed(() => {
  if (!savedAt.value) {
    return undefined
  }
  const ago = savedAgo(now.value.getTime() - savedAt.value.getTime())
  if (ago.unit === 'now') {
    return t('pluto.form.savedJustNow')
  }
  const time = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }).format(-ago.value, ago.unit)
  return t('pluto.form.savedAt', { time })
})

// Callbacks that a widget registers with `usePlutoContentForm().onSaved`.
const savedCallbacks = new Set<(saved: PlutoContentItem) => void>()
function onSaved(callback: (saved: PlutoContentItem) => void) {
  savedCallbacks.add(callback)
  const stop = () => {
    savedCallbacks.delete(callback)
  }
  tryOnScopeDispose(stop)
  return stop
}

// --- Leave guard ---------------------------------------------------------------
//
// A navigation away from a dirty form opens an in-app dialog and waits. The
// browser tab close and a reload use `beforeunload`. `bypass` lets our own
// navigation pass: after a create, an id change, a delete, or "Leave".
const leaveOpen = ref(false)
const isDeleteModalOpen = ref(false)
let leaveTarget: RouteLocationNormalized | null = null
let bypass = false

function guardNavigation(to: RouteLocationNormalized) {
  if (bypass || !dirty.value) {
    return true
  }
  leaveTarget = to
  leaveOpen.value = true
  return false
}

onBeforeRouteLeave(guardNavigation)
onBeforeRouteUpdate(guardNavigation)

function stayOnPage() {
  leaveOpen.value = false
  leaveTarget = null
}

async function leavePage() {
  const target = leaveTarget
  leaveOpen.value = false
  leaveTarget = null
  bypass = true
  if (target) {
    await navigateTo(target.fullPath)
  }
}

useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty.value && !bypass) {
    event.preventDefault()
    // Some browsers need a value on the event to show the dialog.
    event.returnValue = ''
  }
})

// Ctrl+S on Windows and Linux, Cmd+S on macOS. It saves like the Save button
// (not Publish) and stops the browser from saving the page.
useEventListener('keydown', (event: KeyboardEvent) => {
  if (!isSaveShortcut(event) || !canSave.value || saving.value || leaveOpen.value || isDeleteModalOpen.value) {
    return
  }
  event.preventDefault()
  onSave()
})

async function onSave(statusOverride?: string) {
  const type = contentType.value
  if (!type || saving.value) {
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
  saveStatus.value = 'idle'
  lastStatusOverride = statusOverride

  try {
    const saved = await save(payload)

    // The saved item is the new baseline. A widget can write its own normal
    // form of the new value on the next tick, so read the baseline again then.
    tracker.reset(snapshot.value)
    await nextTick()
    tracker.reset(snapshot.value)
    saveStatus.value = 'saved'
    savedAt.value = new Date()
    for (const callback of savedCallbacks) {
      callback(saved)
    }

    if (!editing.value) {
      toast.add({
        title: t('pluto.form.created'),
        description: t('pluto.form.createdDescription', { label: text.label }),
        color: 'success',
      })
      bypass = true
      await navigateTo(editPath(saved.id))
      return
    }

    // A save with no override (no status workflow) is a plain save.
    const title =
      statusOverride === undefined
        ? t('pluto.form.saved')
        : statusOverride === publishedValue.value
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
      bypass = true
      await navigateTo(editPath(saved.id), { replace: true })
    }
  } catch (error) {
    // A raced permissions check, or any other server-side rejection
    // (a 403 included), surfaces here rather than as an unhandled
    // rejection.
    saveStatus.value = 'failed'
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
    bypass = true
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

// In edit mode, the toolbar title and the tab title show the title of the
// item. While the item loads, or when it has no title, they show "Edit <type>".
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

const layout = computed<PlutoContentFormLayout>(() => contentType.value?.form?.layout ?? 'default')
const isCanvas = computed(() => layout.value === 'canvas')
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

// --- Canvas layout --------------------------------------------------------------
//
// The canvas field fills the main region. Its widget adds panels with
// PlutoContentCanvasPanel: `left` ones stack in the left panel, `right` ones
// are tabs of the right panel. The "Page" tab holds every other field.
const canvasFieldDef = computed(() =>
  isCanvas.value
    ? contentType.value?.fields.find((field) => field.name === contentType.value?.form?.canvasField)
    : undefined
)
const pageFields = computed(() =>
  (contentType.value?.fields ?? [])
    .filter((field) => field.inForm !== false && field.name !== canvasFieldDef.value?.name)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
)

const panelGetters = shallowRef<Array<() => PlutoCanvasPanelDef>>([])
const panels = computed(() => panelGetters.value.map((getter) => getter()))
const leftPanels = computed(() => panels.value.filter((panel) => panel.side === 'left'))
const rightPanels = computed(() => panels.value.filter((panel) => panel.side === 'right'))

const leftTarget = shallowRef<HTMLElement | null>(null)
const rightTargets = shallowReactive<Record<string, HTMLElement | null>>({})
function setLeftTarget(el: unknown) {
  leftTarget.value = (el as HTMLElement | null) ?? null
}
function setRightTarget(id: string, el: unknown) {
  rightTargets[id] = (el as HTMLElement | null) ?? null
}

if (isCanvas.value) {
  provide(plutoCanvasHostKey, {
    registerPanel(getter) {
      panelGetters.value = [...panelGetters.value, getter]
      return () => {
        panelGetters.value = panelGetters.value.filter((entry) => entry !== getter)
      }
    },
    leftTarget,
    rightTarget: (id) => rightTargets[id] ?? null,
  })
}

const rightTabs = computed(() => [
  ...rightPanels.value.map((panel) => ({ value: panel.id, label: panel.label ?? panel.id, icon: panel.icon })),
  ...(pageFields.value.length > 0 ? [{ value: 'page', label: t('pluto.canvas.page'), icon: 'i-lucide-file-text' }] : []),
])
const chosenTab = ref<string>()
const activeTab = computed({
  get: () => (rightTabs.value.some((tab) => tab.value === chosenTab.value) ? chosenTab.value : rightTabs.value[0]?.value),
  set: (value) => {
    chosenTab.value = value
  },
})

// On a narrow screen both panels are slideovers. They start closed and keep
// no cookie, so a saved "open" never covers the page on the first visit.
const leftCookie = useCookie<boolean>(`pluto-content-left-${props.type}`, { default: () => true })
const leftNarrow = ref(false)
const rightNarrow = ref(false)
const leftOpen = computed({
  get: () => (isDesktop.value ? leftCookie.value : leftNarrow.value),
  set: (value) => {
    if (isDesktop.value) {
      leftCookie.value = value
    } else {
      leftNarrow.value = value
    }
  },
})
const asideModel = computed({
  get: () => (isCanvas.value && !isDesktop.value ? rightNarrow.value : asideOpen.value),
  set: (value) => {
    if (isCanvas.value && !isDesktop.value) {
      rightNarrow.value = value
    } else {
      asideOpen.value = value
    }
  },
})

const hasLeft = computed(() => isCanvas.value && leftPanels.value.length > 0 && !loadFailed.value)
// A type that declares its left panel (`form.leftPanel`) shows a skeleton of it until the
// widget registers the real panel.
const leftPanelOption = computed(() => {
  const option = contentType.value?.form?.leftPanel
  return typeof option === 'string' ? { label: option } : option
})
// The canvas widget rendered (its code loaded). After that, a missing left panel is final: the
// widget shows none in its current mode, so the skeleton goes.
const canvasReady = ref(false)
const leftSkeleton = computed(() => isCanvas.value && !hasLeft.value && !loadFailed.value && Boolean(leftPanelOption.value) && (itemPending.value || !canvasReady.value))
const leftTitle = computed(() => leftPanels.value[0]?.label ?? (leftPanelOption.value ? tx(leftPanelOption.value.label) : undefined))
const hasRight = computed(() => isCanvas.value && rightTabs.value.length > 0 && !loadFailed.value)

function openPanel(id: string) {
  chosenTab.value = id
  asideModel.value = true
}

// The aside toggle has no use when the aside is inline, or when the item did not load.
const showAsideToggle = computed(() =>
  isCanvas.value ? hasRight.value : showAside.value && !inlineAside.value && !loadFailed.value
)

function toggleAside() {
  asideModel.value = !asideModel.value
}

// --- Context for the widgets ------------------------------------------------------

provide(plutoContentFormKey, {
  type: contentType,
  item,
  editing,
  saving,
  dirty,
  errorsByField: computed(() =>
    Object.fromEntries(validationErrors.value.map((error) => [error.field, validationText(error)]))
  ),
  layout,
  canvas: isCanvas,
  onSaved,
  openPanel,
})

// --- Registry content actions --------------------------------------------------

const toolbarActions = usePlutoContentActions(props.type, 'toolbar')
const toolbarItems = usePlutoContentToolbarItems(props.type)

// Only used while a content type exists, so `contentType.value` is set by
// the time this is read.
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

// --- Toolbar data ----------------------------------------------------------------
//
// The header holds no form logic. It gets plain data and sends events back.

// The public page of the item, from `previewUrl` of the type.
const viewUrl = computed(() => {
  if (!editing.value || loadFailed.value || itemPending.value) {
    return undefined
  }
  try {
    return contentType.value?.previewUrl?.(item.value as PlutoContentItem) || undefined
  } catch {
    // A broken previewUrl must not break the form.
    return undefined
  }
})

const headerStatus = computed(() =>
  statusConfig.value ? { label: statusLabel.value ?? '', published: isPublished.value } : undefined
)

const headerActions = computed<PlutoFormHeaderButton[]>(() => {
  if (!contentType.value) {
    return []
  }
  const context = buildActionContext()
  return toolbarActions.value
    .filter((action) => action.show?.(context) !== false)
    .map((action) => ({
      id: `action:${action.id}`,
      label: action.label,
      icon: action.icon ?? '',
      color: action.color as PlutoFormHeaderButton['color'],
      variant: action.variant as PlutoFormHeaderButton['variant'],
      secondary: true,
    }))
})

const headerButtons = computed<PlutoFormHeaderButton[]>(() => {
  const buttons: PlutoFormHeaderButton[] = []
  if (canSave.value && !statusConfig.value) {
    buttons.push({ id: 'save', label: t('pluto.common.save'), icon: 'lucide:save', variant: 'solid' })
  }
  if (canSave.value && statusConfig.value && !isPublished.value) {
    buttons.push({ id: 'save', label: t('pluto.form.saveDraft'), icon: 'lucide:save', variant: 'subtle', secondary: true })
  }
  if (canSave.value && statusConfig.value && isPublished.value) {
    buttons.push({ id: 'save', label: t('pluto.form.update'), icon: 'lucide:save', variant: 'solid' })
  }
  if (canPublishNow.value && statusConfig.value && !isPublished.value) {
    buttons.push({ id: 'publish', label: t('pluto.form.publish'), icon: 'lucide:upload', variant: 'solid' })
  }
  return buttons
})

function onHeaderPress(id: string) {
  if (id === 'save') {
    onSave()
  } else if (id === 'publish') {
    onSave(publishedValue.value)
  } else {
    toolbarActions.value.find((entry) => `action:${entry.id}` === id)?.onSelect(buildActionContext())
  }
}

// On desktop the panels close from a button in their own header (PlutoViewAside, and
// PlutoViewLeftCollapse in the left panel content), and a closed panel opens from a small
// floating button of PlutoViewAdminPanel (`panel-toggles`). So the toolbar shows the toggles on a
// narrow screen only, plus the left one while the left panel content has no collapse button.
const viewPanel = ref<{
  leftCollapsible: boolean
}>()

const asideToggle = computed(() => {
  if (!showAsideToggle.value || isDesktop.value) {
    return undefined
  }
  const open = asideModel.value
  return {
    label: open ? t('pluto.form.hideSettings') : t('pluto.form.showSettings'),
    icon: open ? 'lucide:panel-right-close' : 'lucide:panel-right-open',
  }
})
const leftToggle = computed(() => {
  if (!hasLeft.value || (isDesktop.value && (!leftOpen.value || viewPanel.value?.leftCollapsible))) {
    return undefined
  }
  const open = leftOpen.value
  return {
    label: open ? t('pluto.canvas.hideSidebar') : t('pluto.canvas.showSidebar'),
    icon: open ? 'lucide:panel-left-close' : 'lucide:panel-left-open',
  }
})
const canUnpublish = computed(() => Boolean(statusConfig.value) && isPublished.value && canPublish.value && !loadFailed.value)
const canShowDelete = computed(() => editing.value && canDelete.value && !loadFailed.value)

// The aside of the default and focus layouts shows when it has fields. The
// canvas layout shows it when a panel or the "Page" tab exists.
const asideSlot = computed(() => (isCanvas.value ? hasRight.value : showAside.value && !inlineAside.value && !loadFailed.value))
const asideTitle = computed(() =>
  isCanvas.value && rightTabs.value.length === 1 ? rightTabs.value[0]!.label : t('pluto.common.settings')
)
</script>

<template>
  <PlutoViewAdminPanel
    v-if="contentType"
    ref="viewPanel"
    v-model:left-open="leftOpen"
    :aside-open="asideSlot && asideModel"
    :left-title="leftTitle"
    :width="layout === 'default' ? 'container' : 'full'"
    :fill="isCanvas"
    panel-toggles
    @update:aside-open="asideModel = $event"
  >
    <template #toolbar>
      <PlutoContentFormHeader
        :back-to="basePath"
        :type-label="text.labelPlural"
        :title="heading"
        :status="headerStatus"
        :save-state="saveState"
        :saved-text="savedText"
        :view-url="viewUrl"
        :toolbar-items="toolbarItems"
        :actions="headerActions"
        :buttons="headerButtons"
        :saving="saving"
        :can-unpublish="canUnpublish"
        :can-delete="canShowDelete"
        :aside-toggle="asideToggle"
        :left-toggle="leftToggle"
        @press="onHeaderPress"
        @retry="onSave(lastStatusOverride)"
        @unpublish="onSave(draftValue)"
        @delete="openDeleteModal"
        @toggle-aside="toggleAside"
        @toggle-left="leftOpen = !leftOpen"
      />
    </template>

    <UAlert
      v-if="validationErrors.length > 0"
      :title="t('pluto.form.fixErrors')"
      :class="isCanvas ? 'm-4 shrink-0' : undefined"
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
    <PlutoSkeletonCanvas v-else-if="itemPending && isCanvas" />

    <template v-else-if="itemPending">
      <PlutoSkeletonField v-for="field in mainFields" :key="field.name" :field="field" />
    </template>

    <!--
      The canvas field fills the main region. Its widget root must fill its
      parent (\`h-full\`), and scrolls its own content.
    -->
    <div v-else-if="isCanvas" class="flex min-h-0 flex-1 flex-col">
      <PlutoContentField
        v-if="canvasFieldDef"
        :type="type"
        :field="canvasFieldDef"
        :model-value="item[canvasFieldDef.name]"
        :disabled="!canWrite || saving"
        canvas
        @ready="canvasReady = true"
        @update:model-value="updateField(canvasFieldDef, $event)"
      />
    </div>

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
        <PlutoSkeletonField v-for="field in sideFields" :key="field.name" :field="field" />
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

    <!-- The left panel of the canvas layout. Widget panels teleport into it. -->
    <template v-if="hasLeft" #left>
      <div :ref="setLeftTarget" class="flex min-h-0 flex-1 flex-col" />
    </template>
    <template v-else-if="leftSkeleton" #left>
      <PlutoSkeletonPanel :title="leftTitle" :class="leftPanelOption?.class" />
    </template>

    <template v-if="asideSlot" #aside>
      <PlutoViewAside v-model:open="asideModel" :title="asideTitle">
        <template v-if="isCanvas && rightTabs.length > 1" #header>
          <UTabs
            v-model="activeTab"
            :items="rightTabs"
            :content="false"
            :aria-label="t('pluto.canvas.panels')"
            :ui="{ list: 'border-b-0 p-0', trigger: 'px-2' }"
            size="sm"
            variant="link"
            color="neutral"
          />
        </template>

        <!-- Canvas: one box for each widget panel, and the "Page" fields. Boxes stay mounted. -->
        <div v-if="isCanvas" class="flex flex-col gap-6">
          <div
            v-for="panel in rightPanels"
            v-show="activeTab === panel.id"
            :key="panel.id"
            :ref="(el) => setRightTarget(panel.id, el)"
            class="flex min-h-0 flex-col"
          />

          <div v-show="activeTab === 'page'" class="flex flex-col gap-6">
            <template v-if="itemPending">
              <PlutoSkeletonField v-for="field in pageFields" :key="field.name" :field="field" />
            </template>

            <template v-else>
              <PlutoContentField
                v-for="field in pageFields"
                :key="field.name"
                :type="type"
                :field="field"
                :model-value="item[field.name]"
                :disabled="!canWrite || saving"
                @update:model-value="updateField(field, $event)"
              />
            </template>
          </div>
        </div>

        <div v-else class="flex flex-col gap-6">
          <template v-if="itemPending">
            <PlutoSkeletonField v-for="field in sideFields" :key="field.name" :field="field" />
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

  <!-- The leave dialog. Closing it with Escape or a click outside means "Stay". -->
  <Modal :model-value="leaveOpen" :custom-size="480" @update:model-value="!$event && stayOnPage()">
    <ModalHeader @close="stayOnPage">
      {{ t('pluto.form.leaveTitle') }}
    </ModalHeader>

    <ModalContent>
      <p>{{ t('pluto.form.leaveDescription') }}</p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          icon="lucide:arrow-left"
          variant="ghost"
          color="neutral"
          @click="stayOnPage"
        >
          {{ t('pluto.form.stay') }}
        </UButton>

        <UButton
          icon="lucide:log-out"
          color="error"
          @click="leavePage"
        >
          {{ t('pluto.form.leave') }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
