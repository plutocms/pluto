<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { RouteLocationNormalized } from 'vue-router'
import type { DirtyState } from '../../../composables/internal/content-dirty'
import {
  createDirtyTracker,
  isEditingEvent,
  isSaveShortcut,
  savedAgo,
} from '../../../composables/internal/content-dirty'
import { buildContentPayload } from '../../../composables/internal/content-payload'
import { errorKey } from '../../../composables/internal/error-text'
import {
  initialValues,
  keepKnownIds,
  readRemembered,
  rememberFields,
  rememberKey,
  writeRemembered,
} from '../../../composables/internal/form-initial-values'
import { restorePlutoTrashItem } from '../../../composables/pluto-content-trash'
import PlutoContentSingletonIntro from './PlutoContentSingletonIntro.vue'

const props = defineProps<{
  /** A content type's `name` (not a registry entry id) — see `usePlutoContentTypes`. */
  type: string
  /** Present in edit mode. Absent in "new entry" mode. */
  id?: string | number
}>()

const emit = defineEmits<{
  /**
   * A singleton type: the first save created the item. The page shows the form of the item
   * (`PlutoContentSingleton`), because the form has no other address to go to.
   */
  created: [id: string | number]
}>()

const { byName } = usePlutoContentTypes()
const contentType = computed(() => byName(props.type))
const { t, tx, d, locale } = usePlutoI18n()
const text = usePlutoContentText(contentType)
const errorText = usePlutoErrorText()

if (!contentType.value) {
  console.error(
    `PlutoContentForm: content type "${props.type}" was not found in the registry.`
  )
}

const { can } = usePlutoPermissions()

// No capability declared means open to anyone who can reach this page. Never call can('') for that.
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
const singleton = computed(() => isSingletonType(contentType.value))
const basePath = computed(
  () => contentType.value?.basePath ?? `/admin/content/${props.type}`
)

function editPath(id: string | number) {
  return (
    contentType.value?.editPath?.(id) ??
    `${basePath.value}/${contentIdPath(id)}`
  )
}

const {
  item,
  pending: itemPending,
  loadError,
  refresh,
  save,
  remove,
} = usePlutoContentItem(props.type, () => props.id)

const { user: rememberUser } = usePlutoAuth()
const rememberBase = useRuntimeConfig().app.baseURL

function rememberStorage(): Storage | null {
  try {
    return import.meta.client ? window.localStorage : null
  } catch {
    return null
  }
}

function rememberKeyOf(field: string): string | null {
  const userId = rememberUser.value?.id
  return userId && contentType.value
    ? rememberKey({
        base: rememberBase,
        userId: String(userId),
        type: contentType.value.name,
        field,
      })
    : null
}

if (!editing.value) {
  const storage = rememberStorage()
  const remembered: Record<string, unknown> = {}
  for (const field of rememberFields(contentType.value)) {
    const key = rememberKeyOf(field.name)
    const value = storage && key ? readRemembered(storage, key) : undefined
    if (value !== undefined) {
      remembered[field.name] = value
    }
  }
  const values = initialValues(contentType.value, remembered)
  if (Object.keys(values).length > 0) {
    item.value = { ...values, ...item.value }
  }
  for (const field of rememberFields(contentType.value)) {
    if (remembered[field.name] === undefined) {
      continue
    }
    const filled = item.value[field.name]
    const options = usePlutoReferenceOptions(field.target)
    options
      .ensure()
      .then(() => {
        if (options.error.value || item.value[field.name] !== filled) {
          return
        }
        const known = new Set(options.byId.value.keys())
        const kept = keepKnownIds(field, filled, known)
        if (JSON.stringify(kept) !== JSON.stringify(filled)) {
          item.value = { ...item.value, [field.name]: kept }
        }
      })
      .catch(() => {})
  }
}

function rememberSaved(payload: Record<string, unknown>) {
  const storage = rememberStorage()
  if (!storage) {
    return
  }
  for (const field of rememberFields(contentType.value)) {
    const key = rememberKeyOf(field.name)
    if (key && Object.hasOwn(payload, field.name)) {
      writeRemembered(storage, key, payload[field.name])
    }
  }
}

const loadFailed = computed(
  () => editing.value && !itemPending.value && loadError.value !== null
)
const loadNotFound = computed(() => {
  const error = loadError.value as {
    statusCode?: number
    status?: number
  } | null
  return (error?.statusCode ?? error?.status) === 404
})

const canPublishNow = computed(() => canPublish.value && !loadFailed.value)

function retryLoad() {
  refresh().catch(() => {})
}

const loadFailedActions = computed<ButtonProps[]>(() =>
  loadNotFound.value
    ? []
    : [
        {
          label: t('pluto.common.tryAgain'),
          icon: 'lucide:refresh-ccw',
          color: 'neutral',
          variant: 'outline',
          onClick: retryLoad,
        },
      ]
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

const rules = computed(() => statusRules(contentType.value))
const scheduledValue = computed(() => rules.value?.scheduled)
const reviewValue = computed(() => rules.value?.review)
const isScheduled = computed(
  () =>
    scheduledValue.value !== undefined &&
    currentStatus.value === scheduledValue.value
)
const isReview = computed(
  () =>
    reviewValue.value !== undefined && currentStatus.value === reviewValue.value
)
const scheduledText = computed(() => {
  const column = rules.value?.publishedAtColumn
  const time =
    isScheduled.value && column ? statusTime(item.value[column]) : undefined
  return time === undefined
    ? ''
    : d(new Date(time), { dateStyle: 'medium', timeStyle: 'short' })
})
const scheduledDue = computed(() => {
  const column = rules.value?.publishedAtColumn
  const time =
    isScheduled.value && column ? statusTime(item.value[column]) : undefined
  return time !== undefined && time <= Date.now()
})
const lockedForWriter = computed(
  () =>
    editing.value &&
    !canPublish.value &&
    statusChangeNeedsPublish(
      contentType.value,
      currentStatus.value,
      currentStatus.value
    )
)
const canSave = computed(
  () => canWrite.value && !loadFailed.value && !lockedForWriter.value
)

const toast = useToast()
const saving = ref(false)
const validationErrors = ref<ContentValidationError[]>([])

const saveStatus = ref<'idle' | 'saved' | 'failed'>('idle')
const savedAt = ref<Date | null>(null)
let lastStatusOverride: string | undefined
let lastPublishAt: string | undefined

function validationText(error: ContentValidationError): string {
  if (!error.code) {
    return error.message
  }
  const field = contentType.value?.fields.find(
    (entry) => entry.name === error.field
  )
  return t(`pluto.validation.${error.code}`, {
    ...error.params,
    label: field ? text.fieldLabel(field) : error.field,
  })
}

const dirtyState = reactive<DirtyState>({ baseline: null })
const tracker = createDirtyTracker(dirtyState)
const snapshot = computed(() =>
  stableStringify(buildContentPayload(contentType.value, item.value))
)
watch(snapshot, (value) => tracker.follow(value), { immediate: true })

const dirty = computed(
  () =>
    !itemPending.value && !loadFailed.value && tracker.isDirty(snapshot.value)
)

useEventListener(
  import.meta.client ? document : undefined,
  ['keydown', 'input', 'change', 'paste', 'drop', 'pointerdown'],
  (event: Event) => {
    if (
      !itemPending.value &&
      isEditingEvent(event.type, event.target as Element | null)
    ) {
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

const now = useNow({ interval: 30_000 })
const savedText = computed(() => {
  if (!savedAt.value) {
    return undefined
  }
  const ago = savedAgo(now.value.getTime() - savedAt.value.getTime())
  if (ago.unit === 'now') {
    return t('pluto.form.savedJustNow')
  }
  const time = new Intl.RelativeTimeFormat(locale.value, {
    numeric: 'auto',
  }).format(-ago.value, ago.unit)
  return t('pluto.form.savedAt', { time })
})

const savedCallbacks = new Set<(saved: PlutoContentItem) => void>()
function onSaved(callback: (saved: PlutoContentItem) => void) {
  savedCallbacks.add(callback)
  const stop = () => {
    savedCallbacks.delete(callback)
  }
  tryOnScopeDispose(stop)
  return stop
}

const flushCallbacks = new Set<() => void>()
function onFlush(callback: () => void) {
  flushCallbacks.add(callback)
  const stop = () => {
    flushCallbacks.delete(callback)
  }
  tryOnScopeDispose(stop)
  return stop
}
function runFlush() {
  for (const callback of flushCallbacks) {
    callback()
  }
}

const {
  state: backupState,
  offer: backupOffer,
  changes: backupChanges,
  otherTab: backupOtherTab,
  otherDevice: backupOtherDevice,
  prepareSave: prepareBackupSave,
  conflict: backupConflict,
  merging: backupMerging,
  onConflict: backupOnConflict,
  reloadAndMerge: reloadBackupConflict,
  restore: restoreBackup,
  discard: discardBackup,
  onSaved: backupSaved,
  onRemoved: backupRemoved,
  leave: backupLeave,
} = usePlutoContentBackup({
  type: contentType,
  id: () => props.id,
  editing,
  item,
  dirtyState,
  snapshot,
  dirty,
  ready: computed(
    () => !editing.value || (!itemPending.value && !loadFailed.value)
  ),
  canSave,
  slugTouched,
  interact: () => tracker.interact(),
  flush: runFlush,
  reload: refresh,
  server: usePlutoContentBackupServer(() => contentType.value?.name),
  resetBaseline: async () => {
    tracker.reset(snapshot.value)
    await nextTick()
    tracker.reset(snapshot.value)
  },
})

watch(backupConflict, (value) => {
  if (!value && saveStatus.value === 'failed') {
    saveStatus.value = 'idle'
  }
})

const backupConfirmOpen = ref(false)
let pendingSave: { statusOverride?: string; publishAt?: string } | null = null
const backupTime = computed(() =>
  backupOffer.value
    ? d(backupOffer.value.record.savedAt, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : ''
)

function closeBackupConfirm() {
  backupConfirmOpen.value = false
  pendingSave = null
}

function restoreFromConfirm() {
  closeBackupConfirm()
  restoreBackup()
}

function saveAndDiscard() {
  const save = pendingSave
  closeBackupConfirm()
  discardBackup()
  onSave(save?.statusOverride, save?.publishAt)
}

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
  backupLeave()
  if (target) {
    await navigateTo(target.fullPath)
  }
}

useEventListener('beforeunload', (event: BeforeUnloadEvent) => {
  if (dirty.value && !bypass) {
    event.preventDefault()
    event.returnValue = ''
  }
})

useEventListener('keydown', (event: KeyboardEvent) => {
  if (
    !isSaveShortcut(event) ||
    !canSave.value ||
    saving.value ||
    leaveOpen.value ||
    isDeleteModalOpen.value ||
    backupConfirmOpen.value
  ) {
    return
  }
  event.preventDefault()
  onSave()
})

function saveToastTitle(
  statusOverride: string | undefined,
  statusBefore: string | undefined
): string {
  if (statusOverride === undefined) {
    return t('pluto.form.saved')
  }
  if (statusOverride === publishedValue.value) {
    return t('pluto.form.published')
  }
  if (statusOverride === scheduledValue.value) {
    return t('pluto.form.scheduledFor', { date: scheduledText.value })
  }
  if (statusOverride === reviewValue.value) {
    return t('pluto.form.submitted')
  }
  if (statusOverride === draftValue.value) {
    if (statusBefore === scheduledValue.value) {
      return t('pluto.form.unscheduled')
    }
    return statusBefore === reviewValue.value
      ? t('pluto.form.returnedToDraft')
      : t('pluto.form.unpublished')
  }
  return t('pluto.form.saved')
}

const scheduleOpen = ref(false)
const scheduleInput = ref('')
const scheduleZone = Intl.DateTimeFormat().resolvedOptions().timeZone

function localInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const scheduleTime = computed(() => {
  const time = Date.parse(scheduleInput.value)
  return Number.isNaN(time) ? undefined : time
})
const scheduleInFuture = computed(
  () => scheduleTime.value !== undefined && scheduleTime.value > Date.now()
)

function openSchedule() {
  const column = rules.value?.publishedAtColumn
  const planned =
    isScheduled.value && column ? statusTime(item.value[column]) : undefined
  const start = planned === undefined ? new Date() : new Date(planned)
  if (planned === undefined) {
    start.setDate(start.getDate() + 1)
    start.setHours(9, 0, 0, 0)
  }
  scheduleInput.value = localInputValue(start)
  scheduleOpen.value = true
}

function confirmSchedule() {
  if (!scheduleInFuture.value || scheduledValue.value === undefined) {
    return
  }
  scheduleOpen.value = false
  onSave(scheduledValue.value, new Date(scheduleTime.value!).toISOString())
}

async function onSave(statusOverride?: string, publishAt?: string) {
  const type = contentType.value
  if (!type || saving.value) {
    return
  }

  if (backupState.value === 'offered') {
    pendingSave = { statusOverride, publishAt }
    backupConfirmOpen.value = true
    return
  }

  runFlush()
  const payload = buildContentPayload(
    type,
    item.value,
    statusOverride,
    publishAt
  )
  const statusBefore = currentStatus.value
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
  lastPublishAt = publishAt

  try {
    // Do not write the server copy after the save removed it.
    await prepareBackupSave()
    const saved = await save(payload)

    tracker.reset(snapshot.value)
    await nextTick()
    tracker.reset(snapshot.value)
    saveStatus.value = 'saved'
    savedAt.value = new Date()
    rememberSaved(payload)
    backupSaved(saved.id)
    for (const callback of savedCallbacks) {
      callback(saved)
    }

    if (!editing.value) {
      toast.add({
        title: t('pluto.form.created'),
        description: t('pluto.form.createdDescription', { label: text.label }),
        color: 'success',
      })
      if (singleton.value) {
        emit('created', saved.id)
        return
      }
      bypass = true
      await navigateTo(editPath(saved.id))
      return
    }

    const title = saveToastTitle(statusOverride, statusBefore)

    toast.add({
      title,
      description: t('pluto.form.updated', { label: text.label }),
      color: 'success',
    })

    if (String(saved.id) !== String(props.id)) {
      bypass = true
      await navigateTo(editPath(saved.id), { replace: true })
    }
  } catch (error) {
    saveStatus.value = 'failed'
    if (errorKey(error) === 'pluto.errors.conflict') {
      backupOnConflict()
    } else {
      toast.add({
        title: t('pluto.common.error'),
        description: errorText(error, 'pluto.form.saveError'),
        color: 'error',
      })
    }
  } finally {
    saving.value = false
  }
}

const deleting = ref(false)

function openDeleteModal() {
  isDeleteModalOpen.value = true
}

function trashedToast(id: string | number) {
  toast.add({
    title: t('pluto.list.trash.moved'),
    color: 'success',
    actions: [
      {
        label: t('pluto.list.trash.undo'),
        icon: 'lucide:undo-2',
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          try {
            await restorePlutoTrashItem(props.type, id)
            await navigateTo(editPath(id))
          } catch (error) {
            toast.add({
              title: t('pluto.common.error'),
              description: errorText(error, 'pluto.list.trash.restoreError'),
              color: 'error',
            })
          }
        },
      },
    ],
  })
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
    backupRemoved()
    await navigateTo(basePath.value)
    if (contentType.value?.trash && props.id !== undefined) {
      trashedToast(props.id)
    }
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

const itemTitle = computed(() => {
  const value = editing.value
    ? item.value[contentType.value?.titleField ?? '']
    : undefined
  return typeof value === 'string' ? value.trim() : ''
})
const heading = computed(() =>
  singleton.value
    ? text.label
    : editing.value
      ? itemTitle.value || t('pluto.content.edit', { label: text.label })
      : text.newLabel
)

useHead({ title: () => heading.value })

const layout = computed<PlutoContentFormLayout>(
  () => contentType.value?.form?.layout ?? 'default'
)
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
const asideOpen = useCookie<boolean>(`pluto-content-aside-${props.type}`, {
  default: () => !asideCollapsedByDefault.value,
})

const isDesktop = useMediaQuery('(min-width: 64rem)')
const inlineAside = computed(
  () => showAside.value && layout.value === 'default' && !isDesktop.value
)

const canvasFieldDef = computed(() =>
  isCanvas.value
    ? contentType.value?.fields.find(
        (field) => field.name === contentType.value?.form?.canvasField
      )
    : undefined
)
const claimGetters = shallowRef<Array<() => string[]>>([])
const claimedFields = computed(
  () => new Set(claimGetters.value.flatMap((getter) => getter()))
)
const pageFields = computed(() =>
  (contentType.value?.fields ?? [])
    .filter(
      (field) =>
        field.inForm !== false &&
        field.name !== canvasFieldDef.value?.name &&
        !claimedFields.value.has(field.name)
    )
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
)

const panelGetters = shallowRef<Array<() => PlutoCanvasPanelDef>>([])
const panels = computed(() => panelGetters.value.map((getter) => getter()))
const leftPanels = computed(() =>
  panels.value.filter((panel) => panel.side === 'left')
)
const rightPanels = computed(() =>
  panels.value.filter((panel) => panel.side === 'right')
)

const leftTarget = shallowRef<HTMLElement | null>(null)
const rightTargets = shallowReactive<Record<string, HTMLElement | null>>({})
function setLeftTarget(el: unknown) {
  leftTarget.value = (el as HTMLElement | null) ?? null
}
function setRightTarget(id: string, el: unknown) {
  rightTargets[id] = (el as HTMLElement | null) ?? null
}

const alertsTarget = shallowRef<HTMLElement | null>(null)

if (isCanvas.value) {
  provide(plutoCanvasHostKey, {
    registerPanel(getter) {
      panelGetters.value = [...panelGetters.value, getter]
      return () => {
        panelGetters.value = panelGetters.value.filter(
          (entry) => entry !== getter
        )
      }
    },
    leftTarget,
    rightTarget: (id) => rightTargets[id] ?? null,
    claimFields(getter) {
      claimGetters.value = [...claimGetters.value, getter]
      return () => {
        claimGetters.value = claimGetters.value.filter(
          (entry) => entry !== getter
        )
      }
    },
    claimAlerts(element) {
      const target = element as HTMLElement
      alertsTarget.value = target
      return () => {
        if (alertsTarget.value === target) {
          alertsTarget.value = null
        }
      }
    },
  })
}

const rightTabs = computed(() => [
  ...rightPanels.value.map((panel) => ({
    value: panel.id,
    label: panel.label ?? panel.id,
    icon: panel.icon,
  })),
  ...(pageFields.value.length > 0
    ? [
        {
          value: 'page',
          label: text.label || t('pluto.canvas.page'),
          icon: 'i-lucide-file-text',
        },
      ]
    : []),
])
const chosenTab = ref<string>()
const activeTab = computed({
  get: () =>
    rightTabs.value.some((tab) => tab.value === chosenTab.value)
      ? chosenTab.value
      : rightTabs.value[0]?.value,
  set: (value) => {
    chosenTab.value = value
  },
})

const leftCookie = useCookie<boolean>(`pluto-content-left-${props.type}`, {
  default: () => false,
})
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
  get: () =>
    isCanvas.value && !isDesktop.value ? rightNarrow.value : asideOpen.value,
  set: (value) => {
    if (isCanvas.value && !isDesktop.value) {
      rightNarrow.value = value
    } else {
      asideOpen.value = value
    }
  },
})

usePlutoZenPanel(leftOpen)
usePlutoZenPanel(asideModel)
const zen = usePlutoZen()
onBeforeUnmount(() => {
  zen.active.value = false
})

const hasLeft = computed(
  () => isCanvas.value && leftPanels.value.length > 0 && !loadFailed.value
)
const leftPanelOption = computed(() => {
  const option = contentType.value?.form?.leftPanel
  return typeof option === 'string' ? { label: option } : option
})
const canvasReady = ref(false)
const leftSkeleton = computed(
  () =>
    isCanvas.value &&
    !hasLeft.value &&
    !loadFailed.value &&
    Boolean(leftPanelOption.value) &&
    (itemPending.value || !canvasReady.value)
)
const leftTitle = computed(
  () =>
    leftPanels.value[0]?.label ??
    (leftPanelOption.value ? tx(leftPanelOption.value.label) : undefined)
)

const railPanels = computed(() =>
  leftPanels.value.length > 0
    ? leftPanels.value.map((panel) => ({
        id: panel.id,
        label: panel.label ?? panel.id,
        icon: panel.icon ?? 'lucide:panel-left',
      }))
    : [
        {
          id: 'left',
          label: leftTitle.value ?? t('pluto.canvas.sidebar'),
          icon: 'lucide:panel-left',
        },
      ]
)
const hasRight = computed(
  () => isCanvas.value && rightTabs.value.length > 0 && !loadFailed.value
)

function openPanel(id: string) {
  chosenTab.value = id
  asideModel.value = true
}

const showAsideToggle = computed(() =>
  isCanvas.value
    ? hasRight.value
    : showAside.value && !inlineAside.value && !loadFailed.value
)

function toggleAside() {
  asideModel.value = !asideModel.value
}

const asideSlot = computed(() =>
  isCanvas.value
    ? hasRight.value
    : showAside.value && !inlineAside.value && !loadFailed.value
)

provide(plutoContentFormKey, {
  type: contentType,
  item,
  editing,
  loading: itemPending,
  saving,
  dirty,
  errorsByField: computed(() =>
    Object.fromEntries(
      validationErrors.value.map((error) => [
        error.field,
        validationText(error),
      ])
    )
  ),
  layout,
  canvas: isCanvas,
  panelToggles: computed(() => ({
    left:
      isDesktop.value &&
      !isCanvas.value &&
      (hasLeft.value || Boolean(leftSkeleton.value)) &&
      !leftOpen.value,
    right: isDesktop.value && Boolean(asideSlot.value) && !asideModel.value,
  })),
  onSaved,
  onFlush,
  openPanel,
  updateField(name, value) {
    const field = contentType.value?.fields.find((entry) => entry.name === name)
    if (field) {
      updateField(field, value)
    }
  },
})

const toolbarActions = usePlutoContentActions(props.type, 'toolbar')
const toolbarItems = usePlutoContentToolbarItems(props.type)

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

const viewUrl = computed(() => {
  if (!editing.value || loadFailed.value || itemPending.value) {
    return undefined
  }
  try {
    return (
      contentType.value?.previewUrl?.(item.value as PlutoContentItem) ||
      undefined
    )
  } catch {
    return undefined
  }
})

const headerStatus = computed(() => {
  if (!statusConfig.value) {
    return undefined
  }
  const label = statusLabel.value ?? ''
  if (isScheduled.value && scheduledDue.value) {
    return { label: text.statusLabel(publishedValue.value), published: true }
  }
  if (isScheduled.value && scheduledText.value) {
    const full = t('pluto.form.scheduledFor', { date: scheduledText.value })
    return { label: full, published: false, color: 'info' as const }
  }
  return {
    label,
    published: isPublished.value,
    ...(isReview.value && { color: 'warning' as const }),
  }
})

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
    buttons.push({
      id: 'save',
      label: t('pluto.common.save'),
      icon: 'lucide:save',
      variant: 'solid',
    })
  }
  if (
    canPublishNow.value &&
    scheduledValue.value !== undefined &&
    !isPublished.value
  ) {
    buttons.push({
      id: 'schedule',
      label: isScheduled.value
        ? t('pluto.form.reschedule')
        : t('pluto.form.schedule'),
      icon: 'lucide:calendar-clock',
      variant: 'ghost',
      secondary: true,
    })
  }
  if (canSave.value && statusConfig.value && !isPublished.value) {
    buttons.push({
      id: 'save',
      label:
        isScheduled.value || isReview.value
          ? t('pluto.common.save')
          : t('pluto.form.saveDraft'),
      icon: 'lucide:save',
      variant: 'subtle',
      secondary: true,
    })
  }
  if (canSave.value && statusConfig.value && isPublished.value) {
    buttons.push({
      id: 'save',
      label: t('pluto.form.update'),
      icon: 'lucide:save',
      variant: 'solid',
    })
  }
  if (canPublishNow.value && statusConfig.value && !isPublished.value) {
    buttons.push({
      id: 'publish',
      label: isScheduled.value
        ? t('pluto.form.publishNow')
        : t('pluto.form.publish'),
      icon: 'lucide:upload',
      variant: 'solid',
    })
  } else if (
    canSave.value &&
    !canPublishNow.value &&
    reviewValue.value !== undefined &&
    !isPublished.value &&
    !isScheduled.value &&
    !isReview.value
  ) {
    buttons.push({
      id: 'review',
      label: t('pluto.form.submitReview'),
      icon: 'lucide:send',
      variant: 'solid',
    })
  }
  return buttons
})

function onHeaderPress(id: string) {
  if (id === 'save') {
    onSave()
  } else if (id === 'publish') {
    onSave(publishedValue.value)
  } else if (id === 'schedule') {
    openSchedule()
  } else if (id === 'review') {
    onSave(reviewValue.value)
  } else {
    toolbarActions.value
      .find((entry) => `action:${entry.id}` === id)
      ?.onSelect(buildActionContext())
  }
}

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
  if (
    !hasLeft.value ||
    (isDesktop.value && (!leftOpen.value || viewPanel.value?.leftCollapsible))
  ) {
    return undefined
  }
  const open = leftOpen.value
  return {
    label: open ? t('pluto.canvas.hideSidebar') : t('pluto.canvas.showSidebar'),
    icon: open ? 'lucide:panel-left-close' : 'lucide:panel-left-open',
  }
})
const canUnpublish = computed(
  () =>
    Boolean(statusConfig.value) &&
    !loadFailed.value &&
    (((isPublished.value || isScheduled.value) && canPublish.value) ||
      (isReview.value && canSave.value))
)
const unpublishLabel = computed(() => {
  if (isScheduled.value) {
    return t('pluto.form.unschedule')
  }
  return isReview.value ? t('pluto.form.returnToDraft') : undefined
})
const canShowDelete = computed(
  () =>
    editing.value && canDelete.value && !loadFailed.value && !singleton.value
)

const asideTitle = computed(() =>
  isCanvas.value && rightTabs.value.length === 1
    ? rightTabs.value[0]!.label
    : t('pluto.common.settings')
)
</script>

<template>
  <PlutoViewAdminPanel
    v-if="contentType"
    ref="viewPanel"
    v-model:left-open="leftOpen"
    :aside-open="asideSlot && asideModel"
    :left-title="leftTitle"
    :width="layout !== 'default' ? 'full' : singleton ? 'narrow' : 'container'"
    :fill="isCanvas"
    panel-toggles
    @update:aside-open="asideModel = $event"
  >
    <template #toolbar>
      <PlutoContentFormHeader
        :back-to="singleton ? undefined : basePath"
        :type-label="text.labelPlural"
        :title="heading"
        :status="headerStatus"
        :save-state="saveState"
        :saved-text="savedText"
        :view-url="viewUrl"
        :item-label="text.label"
        :toolbar-items="toolbarItems"
        :actions="headerActions"
        :buttons="headerButtons"
        :saving="saving"
        :can-unpublish="canUnpublish"
        :unpublish-label="unpublishLabel"
        :can-delete="canShowDelete"
        :trash="Boolean(contentType?.trash)"
        :aside-toggle="asideToggle"
        :left-toggle="leftToggle"
        @press="onHeaderPress"
        @retry="onSave(lastStatusOverride, lastPublishAt)"
        @unpublish="onSave(draftValue)"
        @delete="openDeleteModal"
        @toggle-aside="toggleAside"
        @toggle-left="leftOpen = !leftOpen"
      />
    </template>

    <PlutoContentSingletonIntro
      v-if="singleton && !isCanvas && contentType"
      :type="contentType"
      :item="editing && !itemPending ? item : undefined"
      :pending="itemPending"
    />

    <Teleport :to="alertsTarget ?? 'body'" :disabled="!alertsTarget">
      <div
        :class="
          isCanvas
            ? alertsTarget
              ? 'flex flex-col gap-3'
              : 'bg-default flex shrink-0 flex-col gap-3 p-4'
            : 'contents'
        "
        class="empty:hidden"
      >
        <UAlert
          v-if="lockedForWriter && !loadFailed"
          :title="t('pluto.form.lockedTitle')"
          :description="t('pluto.form.lockedHint')"
          color="neutral"
          variant="subtle"
          icon="lucide:lock"
        />

        <PlutoContentBackupAlert
          v-if="backupOffer"
          :type="contentType"
          :offer="backupOffer"
          :changes="backupChanges"
          @restore="restoreBackup"
          @discard="discardBackup"
        />

        <UAlert
          v-if="backupConflict"
          :title="t('pluto.backup.conflict.title')"
          color="warning"
          variant="subtle"
          icon="lucide:triangle-alert"
          role="alert"
        >
          <template #description>
            <p>{{ t('pluto.backup.conflict.description') }}</p>
            <div class="mt-3">
              <UButton
                :label="t('pluto.backup.conflict.reload')"
                :loading="backupMerging"
                icon="lucide:git-merge"
                size="xs"
                color="warning"
                @click="reloadBackupConflict"
              />
            </div>
          </template>
        </UAlert>

        <UAlert
          v-if="backupOtherTab"
          :title="t('pluto.backup.otherTab')"
          color="warning"
          variant="subtle"
          icon="lucide:copy"
          close
          @update:open="backupOtherTab = false"
        />

        <UAlert
          v-if="backupOtherDevice"
          :title="t('pluto.backup.otherDevice')"
          color="warning"
          variant="subtle"
          icon="lucide:monitor-smartphone"
          close
          @update:open="backupOtherDevice = false"
        />

        <UAlert
          v-if="validationErrors.length > 0"
          :title="t('pluto.form.fixErrors')"
          color="error"
        >
          <template #description>
            <ul class="list-disc pl-4">
              <li
                v-for="fieldError in validationErrors"
                :key="fieldError.field"
              >
                {{ validationText(fieldError) }}
              </li>
            </ul>
          </template>
        </UAlert>
      </div>
    </Teleport>

    <UEmpty
      v-if="loadFailed"
      :title="
        loadNotFound ? t('pluto.form.notFound') : t('pluto.form.loadFailed')
      "
      :description="
        loadNotFound
          ? t('pluto.form.notFoundHint')
          : t('pluto.form.loadFailedHint')
      "
      :actions="loadFailedActions"
      icon="lucide:circle-alert"
      variant="naked"
    />

    <PlutoSkeletonCanvas v-else-if="itemPending && isCanvas" />

    <template v-else-if="itemPending">
      <PlutoSkeletonField
        v-for="field in mainFields"
        :key="field.name"
        :field="field"
      />
    </template>

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

    <UCard v-else-if="singleton" :ui="{ body: 'flex flex-col gap-6' }">
      <PlutoContentField
        v-for="field in mainFields"
        :key="field.name"
        :type="type"
        :field="field"
        :model-value="item[field.name]"
        :disabled="!canWrite || saving"
        @update:model-value="updateField(field, $event)"
      />
    </UCard>

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

    <section
      v-if="inlineAside && !loadFailed"
      class="border-default flex flex-col gap-6 border-t pt-6"
    >
      <h2 class="text-highlighted text-xl font-semibold">
        {{ t('pluto.common.settings') }}
      </h2>

      <PlutoContentSideFields
        :fields="sideFields"
        :groups="contentType?.sideGroups"
        :item="item"
        :type="type"
        :disabled="!canWrite || saving"
        :pending="itemPending"
        @update="updateField"
      />
    </section>

    <template v-if="isCanvas && (hasLeft || leftSkeleton)" #rail>
      <UTooltip
        v-for="panel in railPanels"
        :key="panel.id"
        :text="panel.label"
        :content="{ side: 'right' }"
      >
        <UButton
          :icon="panel.icon"
          :aria-label="panel.label"
          :aria-pressed="leftOpen"
          :color="leftOpen ? 'primary' : 'neutral'"
          :variant="leftOpen ? 'soft' : 'ghost'"
          square
          @click="leftOpen = !leftOpen"
        />
      </UTooltip>
    </template>

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

        <div v-if="isCanvas" class="flex flex-col gap-6">
          <div
            v-for="panel in rightPanels"
            v-show="activeTab === panel.id"
            :key="panel.id"
            :ref="(el) => setRightTarget(panel.id, el)"
            class="flex min-h-0 flex-col"
          />

          <div v-show="activeTab === 'page'" class="flex flex-col gap-6">
            <PlutoContentSideFields
              :fields="pageFields"
              :groups="contentType?.sideGroups"
              :item="item"
              :type="type"
              :disabled="!canWrite || saving"
              :pending="itemPending"
              @update="updateField"
            />
          </div>
        </div>

        <div v-else class="flex flex-col gap-6">
          <PlutoContentSideFields
            :fields="sideFields"
            :groups="contentType?.sideGroups"
            :item="item"
            :type="type"
            :disabled="!canWrite || saving"
            :pending="itemPending"
            @update="updateField"
          />
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

  <Modal v-model="scheduleOpen" :custom-size="440">
    <ModalHeader @close="scheduleOpen = false">
      {{ t('pluto.form.scheduleTitle', { label: text.labelLower }) }}
    </ModalHeader>

    <ModalContent>
      <form class="flex flex-col gap-3" @submit.prevent="confirmSchedule">
        <p class="text-muted text-sm">
          {{ t('pluto.form.scheduleHint') }}
        </p>
        <UFormField
          :label="t('pluto.form.scheduleTime')"
          :hint="t('pluto.form.scheduleZone', { zone: scheduleZone })"
          :error="
            scheduleInput && !scheduleInFuture
              ? t('pluto.errors.scheduleInPast')
              : undefined
          "
        >
          <UInput
            v-model="scheduleInput"
            type="datetime-local"
            class="w-full"
            autofocus
          />
        </UFormField>
      </form>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          icon="lucide:x"
          variant="ghost"
          color="neutral"
          @click="scheduleOpen = false"
        >
          {{ t('pluto.common.cancel') }}
        </UButton>
        <UButton
          :disabled="!scheduleInFuture"
          :loading="saving"
          icon="lucide:calendar-clock"
          @click="confirmSchedule"
        >
          {{ t('pluto.form.schedule') }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>

  <Modal v-model="isDeleteModalOpen" :custom-size="480">
    <ModalHeader @close="closeDeleteModal">
      {{
        contentType?.trash
          ? t('pluto.list.trash.moveTitle')
          : t('pluto.form.removeTitle', { label: text.label })
      }}
    </ModalHeader>

    <ModalContent>
      <p>
        {{
          contentType?.trash
            ? t('pluto.list.trash.moveConfirm')
            : t('pluto.content.removeConfirm')
        }}
      </p>
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
          {{
            contentType?.trash
              ? t('pluto.list.trash.move')
              : t('pluto.common.remove')
          }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>

  <Modal
    :model-value="backupConfirmOpen"
    :custom-size="480"
    @update:model-value="!$event && closeBackupConfirm()"
  >
    <ModalHeader @close="closeBackupConfirm">
      {{ t('pluto.backup.confirmTitle') }}
    </ModalHeader>

    <ModalContent>
      <p>{{ t('pluto.backup.confirmDescription', { time: backupTime }) }}</p>
    </ModalContent>

    <ModalFooter>
      <div class="flex items-center gap-4">
        <UButton
          icon="lucide:x"
          variant="ghost"
          color="neutral"
          @click="closeBackupConfirm"
        >
          {{ t('pluto.common.cancel') }}
        </UButton>

        <UButton
          icon="lucide:rotate-ccw"
          variant="outline"
          color="neutral"
          @click="restoreFromConfirm"
        >
          {{ t('pluto.backup.restore') }}
        </UButton>

        <UButton icon="lucide:trash-2" color="error" @click="saveAndDiscard">
          {{ t('pluto.backup.saveAndDiscard') }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>

  <Modal
    :model-value="leaveOpen"
    :custom-size="480"
    @update:model-value="!$event && stayOnPage()"
  >
    <ModalHeader @close="stayOnPage">
      {{ t('pluto.form.leaveTitle') }}
    </ModalHeader>

    <ModalContent>
      <p>{{ t('pluto.form.leaveDescription') }}</p>
    </ModalContent>

    <ModalFooter>
      <div class="grid w-full grid-cols-2 gap-3">
        <UButton
          icon="lucide:arrow-left"
          variant="outline"
          color="neutral"
          class="justify-center"
          @click="stayOnPage"
        >
          {{ t('pluto.form.stay') }}
        </UButton>

        <UButton
          icon="lucide:log-out"
          color="error"
          class="justify-center"
          @click="leavePage"
        >
          {{ t('pluto.form.leave') }}
        </UButton>
      </div>
    </ModalFooter>
  </Modal>
</template>
