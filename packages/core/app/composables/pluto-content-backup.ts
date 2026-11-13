import type { ComputedRef, Ref } from 'vue'
import type { PlutoContentType, PlutoField } from '../../shared/types/content'
import type { PlutoContentBackup } from '../../shared/utils/content-backup'
import type { BackupStore } from './internal/content-backup-store'
import type { BackupRead } from './internal/content-backup-sync'
import type { DirtyState } from './internal/content-dirty'
import {
  backupKey,
  createBackupScheduler,
  createBackupStore,
  deviceId,
  randomId,
} from './internal/content-backup-store'

/**
 * The server copy of a backup (`usePlutoContentBackupServer`). `key` is the item id as text, or
 * '+new'. No method throws, and none sends a request after the server said it keeps no copies (the
 * Git CMS) or refused the caller.
 */
export interface PlutoBackupServer {
  /** Sends the record. Equal to the last record sent: nothing. One write at a time. */
  write?: (
    key: string,
    record: PlutoContentBackup
  ) => Promise<{ otherDevice: boolean }>
  /** `{ record }` (`null`: no copy) when the server answered. `null` when it gave no answer. */
  read: (key: string) => Promise<BackupRead>
  remove: (key: string) => Promise<void>
  /** Sends `body` (the JSON of `record`) in a `keepalive` request, for a page that closes. */
  keepalive?: (key: string, record: PlutoContentBackup, body: string) => void
  /** Forgets the last record sent (a save removed the copy on the server). */
  forget?: () => void
  /** Waits for the write in progress, at most `ms`. */
  settled?: (ms: number) => Promise<void>
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

/** `offered`: a backup waits for the user. `stopped`: the form no longer writes backups. */
export type PlutoBackupState = 'idle' | 'offered' | 'stopped'

const SERVER_WAIT_MS = 3000
const SERVER_WRITE_WAIT_MS = 10_000
const SERVER_WRITE_MAX_WAIT_MS = 30_000
const SERVER_SETTLE_MS = 2000

/**
 * The content backup of `PlutoContentForm`: it keeps the unsaved changes of the form in
 * `localStorage`, and offers them again when the user opens the item. The pure parts are in
 * `shared/utils/content-backup.ts` and `internal/content-backup-store.ts`. This composable is the
 * Vue glue. See the content-backup skill.
 */
export function usePlutoContentBackup(options: {
  type: ComputedRef<PlutoContentType | undefined>
  id: () => string | number | undefined
  editing: ComputedRef<boolean>
  item: Ref<Record<string, unknown>>
  dirtyState: DirtyState
  snapshot: ComputedRef<string>
  dirty: ComputedRef<boolean>
  ready: ComputedRef<boolean>
  canSave: ComputedRef<boolean>
  slugTouched: Ref<boolean>
  interact: () => void
  flush: () => void
  reload: () => Promise<void>
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
  const otherDevice = ref(false)
  const conflict = ref(false)
  const merging = ref(false)
  const checked = ref(false)
  const store = shallowRef<BackupStore | null>(null)
  let device = ''
  let checking = false
  let disposed = false
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

  const scheduler = createBackupScheduler({
    wait: 1000,
    maxWait: 5000,
    run: () => writeNow(),
  })

  function buildRecord(snapshot: string): PlutoContentBackup | null {
    const changes = backupChanges(
      fields.value,
      parseValues(options.dirtyState.baseline),
      parseValues(snapshot)
    )
    if (Object.keys(changes).length === 0) {
      return null
    }
    const version = options.item.value._version
    return {
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
  }

  function sendToServer(record: PlutoContentBackup) {
    options.server
      ?.write?.(serverKey(), record)
      .then((answer) => {
        if (answer?.otherDevice) {
          otherDevice.value = true
        }
      })
      .catch(() => {})
  }

  function writeNow(force = false) {
    scheduler.cancel()
    if (!canWrite()) {
      return
    }
    options.flush()
    if (!options.dirty.value) {
      removeLocal()
      lastWritten = null
      return
    }
    const snapshot = options.snapshot.value
    const record = buildRecord(snapshot)
    if (!record) {
      removeLocal()
      lastWritten = null
      return
    }
    if (snapshot === lastWritten) {
      return
    }

    const result = store.value!.write(key(), record)
    if (result === 'ok') {
      lastWritten = snapshot
      if (force) {
        sendToServer(record)
      }
    } else if (result === 'quota') {
      failed = true
    } else if (import.meta.dev) {
      console.warn(
        '[pluto-backup] The unsaved changes are too large for a browser backup.'
      )
    }
  }

  const serverScheduler = createBackupScheduler({
    wait: SERVER_WRITE_WAIT_MS,
    maxWait: SERVER_WRITE_MAX_WAIT_MS,
    run: () => writeServer(),
  })

  function serverRecord(): PlutoContentBackup | null {
    if (!options.server?.write || !canWrite()) {
      return null
    }
    options.flush()
    return options.dirty.value ? buildRecord(options.snapshot.value) : null
  }

  function writeServer() {
    serverScheduler.cancel()
    if (!navigator.onLine) {
      return
    }
    const record = serverRecord()
    if (record) {
      sendToServer(record)
    }
  }

  function writeServerKeepalive() {
    if (!options.server?.keepalive || !navigator.onLine) {
      return
    }
    const record = serverRecord()
    const body = record ? keepaliveBody(record) : null
    if (record && body) {
      options.server.keepalive(serverKey(), record, body)
    }
  }

  function cancelWrites() {
    scheduler.cancel()
    serverScheduler.cancel()
  }

  async function prepareSave() {
    serverScheduler.cancel()
    await options.server?.settled?.(SERVER_SETTLE_MS)
  }

  watch(options.snapshot, () => {
    if (!canWrite()) {
      return
    }
    if (!options.dirty.value) {
      cancelWrites()
      removeLocal()
      lastWritten = null
      return
    }
    lastChangeAt = Date.now()
    scheduler.schedule()
    if (options.server?.write) {
      serverScheduler.schedule()
    }
  })

  useEventListener('pagehide', () => {
    writeNow()
    writeServerKeepalive()
  })
  useEventListener(
    import.meta.client ? document : undefined,
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') {
        writeNow()
        writeServerKeepalive()
      }
    }
  )
  useEventListener('online', () => {
    if (canWrite() && options.dirty.value && options.server?.write) {
      serverScheduler.schedule()
    }
  })

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

  async function readServer(): Promise<BackupRead> {
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
    await nextTick()

    const parseOptions = { now: Date.now(), ttlMs: PLUTO_BACKUP_TTL_MS }
    const stored = current.read(key())
    const local = stored
      ? parseBackup(stored, { ...parseOptions, fields: fields.value })
      : null
    const answer = await readServer()
    if (disposed) {
      return
    }
    const server = answer?.record
      ? parseBackup(answer.record, { ...parseOptions, fields: fields.value })
      : null
    const pick = pickBackup(local, server, device)
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
        if (answer && needsServerCopy(pick, server)) {
          sendToServer(pick.record)
        }
      } else {
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

  function onConflict() {
    lastWritten = null
    writeNow(true)
    conflict.value = true
  }

  async function reloadAndMerge() {
    if (!conflict.value || merging.value) {
      return
    }
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
    cancelWrites()
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
        if (options.server?.write) {
          serverScheduler.schedule()
        }
      }
    }
  }

  function discard() {
    removeBoth()
    offer.value = null
    state.value = 'idle'
  }

  function onSaved(savedId: string | number) {
    cancelWrites()
    removeLocal()
    options.server?.forget?.()
    lastWritten = null
    offer.value = null
    conflict.value = false
    if (!options.editing.value || String(savedId) !== String(options.id())) {
      state.value = 'stopped'
    } else if (state.value === 'offered') {
      state.value = 'idle'
    }
  }

  function stop() {
    cancelWrites()
    state.value = 'stopped'
  }

  function leave() {
    cancelWrites()
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
    cancelWrites()
  })

  return {
    state,
    offer,
    changes,
    otherTab,
    otherDevice,
    prepareSave,
    conflict,
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
