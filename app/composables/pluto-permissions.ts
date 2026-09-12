/** Capabilities declared by every layer, in registry order. */
export function usePlutoCapabilities() {
  const registry = usePlutoRegistry()
  return { items: registry.capabilities.list }
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
  const status = ref<'idle' | 'loading'>('idle')

  async function load() {
    if (!driver.value) {
      return
    }

    status.value = 'loading'
    try {
      granted.value = await driver.value.load()
      loaded.value = true
    } finally {
      status.value = 'idle'
    }
  }

  function clear() {
    granted.value = []
    loaded.value = false
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
    clear,
    can,
  }
}
