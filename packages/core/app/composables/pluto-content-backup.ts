import type { ComputedRef, Ref } from 'vue'
import type { PlutoContentType, PlutoField } from '../../shared/types/content'
import type { PlutoContentBackup } from '../../shared/utils/content-backup'
import type { BackupStore } from './internal/content-backup-store'
import type { DirtyState } from './internal/content-dirty'
import {
  backupKey,
  createBackupScheduler,
  createBackupStore,
  deviceId,
  randomId,
} from './internal/content-backup-store'

/**
 * The server copy of a backup. `PlutoContentForm` passes no server yet. A later version fills this
 * slot. `key` is the item id as text, or '+new'.
 */
export interface PlutoBackupServer {
  /** Sends the record now. The conflict flow calls it. */
  write?: (key: string, record: PlutoContentBackup) => Promise<void>
  read: (key: string) => Promise<PlutoContentBackup | null>
  remove: (key: string) => Promise<void>
}

/** A backup that the form offers to restore. */
export interface PlutoBackupOffer {
  record: PlutoContentBackup
  /** The fields that a restore puts in the form, with the backup value. */
  values: Record<string, unknown>
  /** The fields that changed in both places (the item was saved again after the backup). */
  conflicts: PlutoField[]
  /** The record comes from another device. */
  otherDevice: boolean
}

export type PlutoBackupState = 'idle' | 'offered' | 'stopped'

/** Time to wait for a server copy when the form opens, in ms. */
const SERVER_WAIT_MS = 3000

/**
 * The content backup of `PlutoContentForm`: it keeps the unsaved changes of the form in
 * `localStorage`, and offers them again when the user opens the item. The pure parts are in
 * `shared/utils/content-backup.ts` and `internal/content-backup-store.ts`. This composable is the
 * Vue glue. See the content-backup skill.
 */
export function usePlutoContentBackup(options: {
  type: ComputedRef<PlutoContentType | undefined>
  /** The id of the item. `undefined` on a new item. */
  id: () => string | number | undefined
  editing: ComputedRef<boolean>
  item: Ref<Record<string, unknown>>
  dirtyState: DirtyState
  /** The sorted JSON of the payload now (the form `snapshot`). */
  snapshot: ComputedRef<string>
  dirty: ComputedRef<boolean>
  /** The item loaded (or the item is new). */
  ready: ComputedRef<boolean>
  canSave: ComputedRef<boolean>
  slugTouched: Ref<boolean>
  /** Marks the next change as an edit, so the baseline stays (`tracker.interact`). */
  interact: () => void
  /** Runs the `onFlush` callbacks of the widgets. */
  flush: () => void
  /** Loads the stored item again (`refresh` of the item composable). It rejects on an error. */
  reload: () => Promise<void>
  /** Sets the dirty baseline to the form now, two times as a save does (now and after a tick). */
  resetBaseline: () => Promise<void>
  server?: PlutoBackupServer
}) {
  const { user } = usePlutoAuth()
  const { t } = usePlutoI18n()
  const text = usePlutoContentText(options.type)
  const toast = useToast()
  const base = useRuntimeConfig().app.baseURL
  const userId = computed(() => user.value?.id)
  const tab = randomId()

  const state = ref<PlutoBackupState>('idle')
  const offer = shallowRef<PlutoBackupOffer | null>(null)
  const otherTab = ref(false)
  // A save failed with a 409: someone saved the item after the form loaded it.
  const conflict = ref(false)
  const merging = ref(false)
  // False until the form decided on the offer. Nothing writes before that.
  const checked = ref(false)
  const store = shallowRef<BackupStore | null>(null)
  let device = ''
  let checking = false
  let disposed = false
  // The browser refused a write twice: no more backups in this page view.
  let failed = false
  let lastChangeAt = 0
  let lastWritten: string | null = null

  const fields = computed(() =>
    options.type.value ? backupFields(options.type.value) : []
  )
  const enabled = computed(
    () =>
      store.value !== null &&
      Boolean(userId.value) &&
      options.type.value?.form?.backup !== false
  )

  function key(): string {
    return backupKey({
      base,
      userId: userId.value ?? '',
      type: options.type.value?.name ?? '',
      id: options.id() ?? null,
    })
  }

  /** The id of the server copy: the item id, or '+new'. */
  function serverKey(): string {
    const id = options.id()
    return id === undefined ? '+new' : String(id)
  }

  function parseValues(text: string | null): Record<string, unknown> {
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return {}
    }
  }

  function canWrite(): boolean {
    return (
      enabled.value &&
      checked.value &&
      state.value === 'idle' &&
      !merging.value &&
      options.canSave.value &&
      !failed
    )
  }

  function removeLocal() {
    if (enabled.value) {
      store.value?.remove(key())
    }
  }

  function removeServer() {
    options.server?.remove(serverKey()).catch(() => {})
  }

  function removeBoth() {
    removeLocal()
    removeServer()
  }

  // --- Write --------------------------------------------------------------------

  const scheduler = createBackupScheduler({
    wait: 1000,
    maxWait: 5000,
    run: () => writeNow(),
  })

  /** `force` also sends the server copy now (the conflict flow). */
  function writeNow(force = false) {
    scheduler.cancel()
    if (!canWrite()) {
      return
    }
    // A widget can hold edits that are not in the item yet.
    options.flush()
    if (!options.dirty.value) {
      removeLocal()
      lastWritten = null
      return
    }
    const snapshot = options.snapshot.value
    const changes = backupChanges(
      fields.value,
      parseValues(options.dirtyState.baseline),
      parseValues(snapshot)
    )
    if (Object.keys(changes).length === 0) {
      removeLocal()
      lastWritten = null
      return
    }
    if (snapshot === lastWritten) {
      return
    }

    const version = options.item.value._version
    const record: PlutoContentBackup = {
      v: 1,
      savedAt: lastChangeAt || Date.now(),
      device,
      tab,
      ...(typeof version === 'string' ? { version } : {}),
      ...(!options.editing.value && options.slugTouched.value
        ? { slugTouched: true }
        : {}),
      changes,
    }
    const result = store.value!.write(key(), record)
    if (result === 'ok') {
      lastWritten = snapshot
      if (force) {
        options.server?.write?.(serverKey(), record).catch(() => {})
      }
    } else if (result === 'quota') {
      failed = true
    } else if (import.meta.dev) {
      console.warn(
        '[pluto-backup] The unsaved changes are too large for a browser backup.'
      )
    }
  }

  watch(options.snapshot, () => {
    if (!canWrite()) {
      return
    }
    if (!options.dirty.value) {
      // Back to the saved text: the backup has nothing to keep.
      scheduler.cancel()
      removeLocal()
      lastWritten = null
      return
    }
    lastChangeAt = Date.now()
    scheduler.schedule()
  })

  // A hidden page can be closed at once, so write now. A page that is shown again needs nothing.
  useEventListener('pagehide', () => writeNow())
  useEventListener(
    import.meta.client ? document : undefined,
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') {
        writeNow()
      }
    }
  )

  // Another tab wrote the backup of this item.
  useEventListener('storage', (event: StorageEvent) => {
    if (
      state.value === 'stopped' ||
      !enabled.value ||
      event.key !== key() ||
      !event.newValue
    ) {
      return
    }
    try {
      const other = JSON.parse(event.newValue) as { tab?: unknown }
      if (typeof other.tab === 'string' && other.tab !== tab) {
        otherTab.value = true
      }
    } catch {
      // A broken record is not a sign of another tab.
    }
  })

  // --- Offer --------------------------------------------------------------------

  async function readServer(): Promise<PlutoContentBackup | null> {
    if (!options.server) {
      return null
    }
    const wait = new Promise<null>((resolve) =>
      setTimeout(resolve, SERVER_WAIT_MS, null)
    )
    try {
      return await Promise.race([options.server.read(serverKey()), wait])
    } catch {
      return null
    }
  }

  async function check() {
    if (
      checked.value ||
      checking ||
      !enabled.value ||
      !options.ready.value ||
      options.dirtyState.baseline === null
    ) {
      return
    }
    checking = true
    const current = store.value!
    current.prune(base, userId.value!)
    // A widget can write its own normal form of the loaded value right after it mounts. The
    // baseline follows it. Read the baseline after that.
    await nextTick()

    const parseOptions = { now: Date.now(), ttlMs: PLUTO_BACKUP_TTL_MS }
    const stored = current.read(key())
    const local = stored
      ? parseBackup(stored, { ...parseOptions, fields: fields.value })
      : null
    const server = await readServer()
    if (disposed) {
      return
    }
    const pick = pickBackup(
      local,
      server
        ? parseBackup(server, { ...parseOptions, fields: fields.value })
        : null,
      device
    )
    if (pick) {
      const plan = planRestore(
        fields.value,
        pick.record,
        parseValues(options.dirtyState.baseline)
      )
      if (Object.keys(plan.values).length > 0) {
        offer.value = {
          record: pick.record,
          values: plan.values,
          conflicts: fields.value.filter((field) =>
            plan.conflicts.includes(field.name)
          ),
          otherDevice: pick.otherDevice,
        }
        state.value = 'offered'
      } else {
        // The backup holds nothing new: the item already has these values.
        removeBoth()
      }
    }
    checked.value = true
    checking = false
  }

  onMounted(() => {
    let storage: Storage | null = null
    try {
      storage = window.localStorage
    } catch {
      // Storage is not available (a browser setting).
    }
    if (storage) {
      device = deviceId(storage)
      store.value = createBackupStore(storage, {
        maxChars: PLUTO_BACKUP_MAX_CHARS,
        maxTotalChars: PLUTO_BACKUP_MAX_TOTAL_CHARS,
        maxCount: PLUTO_BACKUP_MAX_COUNT,
        ttlMs: PLUTO_BACKUP_TTL_MS,
        now: () => Date.now(),
        parse: parseBackup,
      })
    }
    watch(
      [enabled, options.ready, () => options.dirtyState.baseline !== null],
      check,
      { immediate: true }
    )
  })

  // --- Choices of the user ------------------------------------------------------------

  /** Puts the backup values in the form. The form is dirty, and the next writes keep them. */
  function restore() {
    const current = offer.value
    if (!current) {
      return
    }
    if (!options.editing.value && current.record.slugTouched) {
      options.slugTouched.value = true
    }
    options.interact()
    options.item.value = { ...options.item.value, ...current.values }
    offer.value = null
    state.value = 'idle'
    toast.add({
      title: t('pluto.backup.restored'),
      description: t('pluto.backup.restoredHint'),
      color: 'success',
      icon: 'lucide:life-buoy',
    })
  }

  /**
   * The save failed with a 409. Write the backup now, so the changes are safe, and show the
   * conflict alert.
   */
  function onConflict() {
    // The last write may be equal to the form: write again to send the server copy.
    lastWritten = null
    writeNow(true)
    conflict.value = true
  }

  /**
   * "Load the latest and keep my changes": load the stored item again, make it the baseline, and
   * put the changes of the backup on top of it. There is no offer. If the load fails, the backup
   * stays and the alert stays.
   */
  async function reloadAndMerge() {
    if (!conflict.value || merging.value) {
      return
    }
    // Write the unsaved changes first, then read them back. The record has the base values.
    writeNow(true)
    const stored = store.value?.read(key()) ?? null
    const record = stored
      ? parseBackup(stored, {
          now: Date.now(),
          ttlMs: PLUTO_BACKUP_TTL_MS,
          fields: fields.value,
        })
      : null

    merging.value = true
    scheduler.cancel()
    try {
      try {
        await options.reload()
      } catch {
        toast.add({
          title: t('pluto.form.loadFailed'),
          description: t('pluto.form.loadFailedHint'),
          color: 'error',
        })
        return
      }
      // A widget can write its own normal form of the new value on the next tick.
      await options.resetBaseline()

      conflict.value = false
      const plan = record
        ? planRestore(
            fields.value,
            record,
            parseValues(options.dirtyState.baseline)
          )
        : null
      if (!record || !plan || Object.keys(plan.values).length === 0) {
        // The stored item already has the values of the backup.
        removeBoth()
        lastWritten = null
        toast.add({
          title: t('pluto.backup.conflict.merged'),
          color: 'success',
          icon: 'lucide:git-merge',
        })
        return
      }
      options.interact()
      options.item.value = { ...options.item.value, ...plan.values }
      const both = fields.value
        .filter((field) => plan.conflicts.includes(field.name))
        .map((field) => text.fieldLabel(field))
      toast.add({
        title: t('pluto.backup.conflict.merged'),
        description:
          both.length > 0
            ? t('pluto.backup.conflicts', { fields: both.join(', ') })
            : t('pluto.backup.conflict.mergedHint'),
        color: both.length > 0 ? 'warning' : 'success',
        icon: 'lucide:git-merge',
      })
    } finally {
      merging.value = false
      if (state.value === 'idle' && options.dirty.value) {
        lastChangeAt = Date.now()
        scheduler.schedule()
      }
    }
  }

  /** Removes the backup. */
  function discard() {
    removeBoth()
    offer.value = null
    state.value = 'idle'
  }

  /** The form saved the item. The backup of the item has nothing left to keep. */
  function onSaved(savedId: string | number) {
    scheduler.cancel()
    removeBoth()
    lastWritten = null
    offer.value = null
    conflict.value = false
    if (!options.editing.value || String(savedId) !== String(options.id())) {
      // The form navigates now (a new item, or an id change).
      state.value = 'stopped'
    } else if (state.value === 'offered') {
      state.value = 'idle'
    }
  }

  /** The form does not write any more (it navigates away). The backup stays. */
  function stop() {
    scheduler.cancel()
    state.value = 'stopped'
  }

  /** The user left without saving, or the item was removed: no backup stays, and none is written. */
  function leave() {
    scheduler.cancel()
    removeBoth()
    offer.value = null
    conflict.value = false
    state.value = 'stopped'
  }

  const changes = computed(() => {
    const current = offer.value
    if (!current) {
      return []
    }
    const names = new Set(Object.keys(current.values))
    return diffFields(
      fields.value.filter((field) => names.has(field.name)),
      options.item.value,
      current.values
    )
  })

  tryOnScopeDispose(() => {
    disposed = true
    scheduler.cancel()
  })

  return {
    state,
    offer,
    /** The changes that a restore makes, for the "Show changes" view. */
    changes,
    otherTab,
    /** A save failed with a 409 and the conflict alert shows. */
    conflict,
    /** The conflict button is loading the latest version. */
    merging,
    onConflict,
    reloadAndMerge,
    restore,
    discard,
    onSaved,
    onRemoved: leave,
    stop,
    leave,
    writeNow,
  }
}
