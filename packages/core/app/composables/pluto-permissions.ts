/** The capabilities of one owner (a layer), for a picker such as the Roles editor. */
export interface PlutoCapabilityGroup {
  /** The owner id (for example `supabase-blog`), or `other` for unknown strings. */
  id: string
  label: string
  items: PlutoCapability[]
}

/**
 * Capabilities declared by every layer, in registry order. The label and the
 * description are key-or-literal. They resolve with `tx()` inside the
 * `computed`, so a locale switch updates them.
 *
 * `groups` splits them by owner: the `<owner>:` prefix of the registry id.
 * A group label is `<owner>.capabilities.group` when that key exists, else the
 * owner id. `groupsFor(keys)` adds an "Other" group
 * (`pluto.capabilities.otherGroup`) with the strings in `keys` that no layer
 * declares, so a role can show a capability it holds but no layer registers.
 *
 * @see https://pluto.vulmix.dev/docs/build/permissions
 */
export function usePlutoCapabilities() {
  const registry = usePlutoRegistry()
  const { t, te, tx } = usePlutoI18n()

  const items = computed<PlutoCapability[]>(() =>
    registry.capabilities.list.value.map((capability) => ({
      ...capability,
      label: tx(capability.label),
      description:
        capability.description === undefined
          ? undefined
          : tx(capability.description),
    }))
  )

  function ownerOf(capability: PlutoCapability): string {
    const index = capability.id.indexOf(':')
    return index === -1 ? capability.id : capability.id.slice(0, index)
  }

  function groupLabel(owner: string): string {
    const key = `${owner}.capabilities.group`
    return te(key) ? t(key) : owner
  }

  function groupsFor(unknownKeys: string[] = []): PlutoCapabilityGroup[] {
    const byOwner = new Map<string, PlutoCapability[]>()
    for (const capability of items.value) {
      const owner = ownerOf(capability)
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), capability])
    }

    const groups = [...byOwner].map(([id, list]) => ({
      id,
      label: groupLabel(id),
      items: list,
    }))

    const known = new Set(items.value.map((capability) => capability.key))
    const other = [...new Set(unknownKeys)]
      .filter((key) => !known.has(key))
      .map((key): PlutoCapability => ({ id: key, key, label: key }))
    if (other.length > 0) {
      groups.push({
        id: 'other',
        label: t('pluto.capabilities.otherGroup'),
        items: other,
      })
    }

    return groups
  }

  const groups = computed<PlutoCapabilityGroup[]>(() => groupsFor())

  return { items, groups, groupsFor }
}

/**
 * The current user's capabilities, backed by whichever permissions driver
 * is registered. `useState` is correct for the loaded list itself (plain
 * strings, and /admin/** is client-only per nuxt.config.ts) — this
 * mirrors usePlutoSettings()'s values/dirty state exactly. The driver
 * registration itself goes through the registry, same as
 * PlutoSettingsDriver.
 *
 * @see https://pluto.vulmix.dev/docs/build/permissions
 */
export function usePlutoPermissions() {
  const registry = usePlutoRegistry()
  const driver = computed(
    () => registry.permissionsDrivers.list.value.at(-1) ?? null
  )

  const granted = useState<string[]>('pluto-permissions-granted', () => [])
  const loaded = useState<boolean>('pluto-permissions-loaded', () => false)
  const loadedFor = useState<string>('pluto-permissions-user', () => '')
  const status = ref<'idle' | 'loading'>('idle')

  function load(userId?: string): Promise<void> {
    const currentDriver = driver.value
    if (!currentDriver) {
      return Promise.resolve()
    }

    const nuxtApp = useNuxtApp()
    const running = nuxtApp._plutoPermissionsLoad as
      | {
          userId: string
          promise: Promise<void>
        }
      | undefined
    if (running && (userId === undefined || running.userId === userId)) {
      return running.promise
    }

    const entry = { userId: userId ?? '', promise: Promise.resolve() }
    entry.promise = (async () => {
      status.value = 'loading'
      try {
        const list = await currentDriver.load()
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
