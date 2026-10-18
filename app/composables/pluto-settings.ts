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
      description: panel.description === undefined ? undefined : tx(panel.description),
    }))
  )

  return { items }
}

/**
 * The settings value store, backed by whichever settings driver is
 * registered. `useState` is correct here: these are plain strings, not
 * components, and `/admin/**` is client-only per `nuxt.config.ts`, so there
 * is no SSR-serialization concern.
 */
export function usePlutoSettings() {
  const registry = usePlutoRegistry()
  const driver = computed(() => registry.settingsDrivers.list.value.at(-1) ?? null)

  const values = useState<Record<string, string>>('pluto-settings-values', () => ({}))
  const dirty = useState<Record<string, string>>('pluto-settings-dirty', () => ({}))
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
