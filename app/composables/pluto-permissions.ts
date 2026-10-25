/**
 * Capabilities declared by every layer, in registry order. The label and the
 * description are key-or-literal. They resolve with `tx()` inside the
 * `computed`, so a locale switch updates them.
 */
export function usePlutoCapabilities() {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()

  const items = computed<PlutoCapability[]>(() =>
    registry.capabilities.list.value.map((capability) => ({
      ...capability,
      label: tx(capability.label),
      description: capability.description === undefined ? undefined : tx(capability.description),
    }))
  )

  return { items }
}

/**
 * The current user's capabilities, backed by whichever permissions driver
 * is registered. `useState` is correct for the loaded list itself (plain
 * strings, and /admin/** is client-only per nuxt.config.ts) — this
 * mirrors usePlutoSettings()'s values/dirty state exactly. The driver
 * registration itself goes through the registry, same as
 * PlutoSettingsDriver.
 */
export function usePlutoPermissions() {
  const registry = usePlutoRegistry()
  const driver = computed(() => registry.permissionsDrivers.list.value.at(-1) ?? null)

  const granted = useState<string[]>('pluto-permissions-granted', () => [])
  const loaded = useState<boolean>('pluto-permissions-loaded', () => false)
  // The user id the loaded list belongs to. Empty when none or unknown.
  const loadedFor = useState<string>('pluto-permissions-user', () => '')
  const status = ref<'idle' | 'loading'>('idle')

  /**
   * Loads the list. One request at a time: a second call while a request is
   * in flight returns the same promise (the auth sync plugin and the route
   * guard both call it). A call for another user id starts a new request, and
   * the older result is dropped. The in-flight request lives on `nuxtApp`, so
   * it is per app and never in the SSR payload.
   */
  function load(userId?: string): Promise<void> {
    const currentDriver = driver.value
    if (!currentDriver) {
      return Promise.resolve()
    }

    const nuxtApp = useNuxtApp()
    // Cast: see `usePlutoRegistry` for why vue-tsc needs it.
    const running = nuxtApp._plutoPermissionsLoad as {
 userId: string
promise: Promise<void>
} | undefined
    if (running && (userId === undefined || running.userId === userId)) {
      return running.promise
    }

    const entry = { userId: userId ?? '', promise: Promise.resolve() }
    entry.promise = (async () => {
      status.value = 'loading'
      try {
        const list = await currentDriver.load()
        // Ignore a result that arrives after a sign-out or for an older request.
        if (nuxtApp._plutoPermissionsLoad === entry) {
          granted.value = list
          loaded.value = true
          loadedFor.value = entry.userId
        }
      } finally {
        if (nuxtApp._plutoPermissionsLoad === entry) {
          nuxtApp._plutoPermissionsLoad = undefined
          status.value = 'idle'
        }
      }
    })()
    nuxtApp._plutoPermissionsLoad = entry
    return entry.promise
  }

  /**
   * Makes sure the list belongs to this user. It returns at once when the list
   * is loaded for the same user id. It joins a request in flight for the same
   * id. It loads again when the user id changed.
   */
  async function ensureLoaded(userId: string): Promise<void> {
    if (!driver.value) {
      return
    }
    if (loaded.value && loadedFor.value === userId) {
      return
    }
    await load(userId)
  }

  function clear() {
    useNuxtApp()._plutoPermissionsLoad = undefined
    status.value = 'idle'
    granted.value = []
    loaded.value = false
    loadedFor.value = ''
  }

  /**
   * True when the user holds this capability.
   *
   * Fails OPEN when no permissions driver is registered — a site with no
   * permissions backend also has no server-side guard, so hiding UI in
   * that case would only be theatre, and would break a core-only
   * install with nothing registered yet. Read `hasDriver` to tell the two
   * cases apart if a caller needs to.
   *
   * This is never a security boundary by itself. The server-side guard
   * (a backend layer's own requireCapability-equivalent, backed by RLS)
   * is what actually enforces anything. This only decides what the UI
   * shows.
   */
  function can(capability: string): boolean {
    if (!driver.value) {
      return true
    }

    return granted.value.includes('*') || granted.value.includes(capability)
  }

  return {
    granted,
    loaded,
    status,
    hasDriver: computed(() => Boolean(driver.value)),
    isAdmin: computed(() => granted.value.includes('*')),
    load,
    ensureLoaded,
    clear,
    can,
  }
}
