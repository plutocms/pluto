/**
 * Settings panels registered by every layer, in registry order. The title and
 * the description are key-or-literal. They resolve with `tx()` inside the
 * `computed`, so a locale switch updates them.
 */
export function usePlutoSettingsPanels() {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()

  const items = computed<PlutoSettingsPanel[]>(() =>
    registry.settingsPanels.list.value.map((panel) => ({
      ...panel,
      title: tx(panel.title),
      description:
        panel.description === undefined ? undefined : tx(panel.description),
    }))
  )

  return { items }
}

/**
 * The tabs of the Settings section, registered by every layer through
 * `settingsPages`.
 *
 * - `all`: every enabled page, sorted, with the label resolved.
 * - `items`: the pages the user may see (`can(capability)`; `'*'` is
 *   admin only). The tabs and the sidebar children use this list.
 * - `current`: the page that matches the route, by the longest `to` prefix.
 *   It comes from `all`, so a page the user may not see still resolves.
 * - `allowed`: false when `current` needs a capability the user lacks. The
 *   parent page shows a no-permission alert then. This only decides what the
 *   UI shows. The routes of a page do their own server-side check.
 */
export function usePlutoSettingsPages() {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()
  const { can } = usePlutoPermissions()
  const route = useRoute()

  const all = computed<PlutoSettingsPage[]>(() =>
    registry.settingsPages.list.value.map((page) => ({
      ...page,
      label: tx(page.label),
    }))
  )

  const items = computed<PlutoSettingsPage[]>(() =>
    all.value.filter((page) => !page.capability || can(page.capability))
  )

  const current = computed<PlutoSettingsPage | undefined>(() => {
    const path =
      route.path.length > 1 ? route.path.replace(/\/+$/, '') : route.path
    let best: PlutoSettingsPage | undefined
    for (const page of all.value) {
      const matches = path === page.to || path.startsWith(`${page.to}/`)
      if (matches && (!best || page.to.length > best.to.length)) {
        best = page
      }
    }
    return best
  })

  const allowed = computed(() => {
    const capability = current.value?.capability
    return !capability || can(capability)
  })

  return { all, items, current, allowed }
}

/**
 * The settings value store, backed by whichever settings driver is
 * registered. `useState` is correct here: these are plain strings, not
 * components, and `/admin/**` is client-only per `nuxt.config.ts`, so there
 * is no SSR-serialization concern.
 */
export function usePlutoSettings() {
  const registry = usePlutoRegistry()
  const driver = computed(
    () => registry.settingsDrivers.list.value.at(-1) ?? null
  )

  const values = useState<Record<string, string>>(
    'pluto-settings-values',
    () => ({})
  )
  const dirty = useState<Record<string, string>>(
    'pluto-settings-dirty',
    () => ({})
  )
  const status = ref<'idle' | 'loading' | 'saving'>('idle')

  async function load() {
    if (!driver.value) {
      return
    }
    status.value = 'loading'
    try {
      values.value = await driver.value.load()
    } finally {
      status.value = 'idle'
    }
  }

  async function save() {
    if (!driver.value) {
      return
    }
    status.value = 'saving'
    try {
      await driver.value.save(dirty.value)
      values.value = { ...values.value, ...dirty.value }
      dirty.value = {}
    } finally {
      status.value = 'idle'
    }
  }

  function field(key: string, fallback = '') {
    return computed<string>({
      get: () => dirty.value[key] ?? values.value[key] ?? fallback,
      set: (value) => {
        dirty.value[key] = value
      },
    })
  }

  return {
    values,
    dirty,
    status,
    hasDriver: computed(() => Boolean(driver.value)),
    load,
    save,
    field,
  }
}
