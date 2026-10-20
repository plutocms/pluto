import { ADMIN_LOGIN_PATH, isAdminPath, matchPublicPath, normalizePublicPaths, safeRedirect } from './internal/admin-shell'

let validated = false

/**
 * True after the capabilities of the signed-in user finished loading in the
 * browser. The server never sets it, so it is false in the server HTML and in
 * the first client render. The public-page admin bar waits for it. The auth
 * sync plugin writes it. See `app/plugins/pluto-auth-sync.client.ts`.
 */
export function usePlutoCapabilitiesKnown() {
  return useState<boolean>('pluto-capabilities-known', () => false)
}

/**
 * True after the app hydrated in the browser. False on the server and during
 * hydration. `pluto-auth-sync.client.ts` sets it.
 */
export function usePlutoAppMounted() {
  return useState<boolean>('pluto-app-mounted', () => false)
}

/**
 * The sign-in backend of the admin, through the registered auth driver. The
 * last registered driver wins. With no driver, `user` is null and `loggedIn`
 * is false. In development, a driver that breaks the contract logs one warning
 * for each problem.
 */
export function usePlutoAuth() {
  const registry = usePlutoRegistry()
  // Read at setup, while the Nuxt context exists. `signOut` runs after an await.
  const { t } = usePlutoI18n()
  const toast = useToast()
  const driver = computed(() => registry.authDrivers.list.value.at(-1) ?? null)

  if (import.meta.dev && !validated && driver.value) {
    validated = true
    for (const problem of validatePlutoAuthDriver(driver.value)) {
      console.warn(`[pluto-auth] ${problem}`)
    }
  }

  const user = computed(() => driver.value?.user() ?? null)
  const loggedIn = computed(() => {
    const current = driver.value
    if (!current) {
      return false
    }
    return current.loggedIn ? current.loggedIn() : current.user() !== null
  })
  const publicPaths = computed(() => normalizePublicPaths(driver.value?.publicPaths))

  function ready(): Promise<void> {
    return driver.value ? driver.value.ready() : Promise.resolve()
  }

  function isPublicPath(path: string): boolean {
    return isAdminPath(path) && matchPublicPath(path, publicPaths.value) !== undefined
  }

  async function signOut() {
    if (!driver.value) {
      return
    }
    await driver.value.signOut()
    toast.add({ title: t('pluto.navbar.signedOut'), color: 'success' })
    await navigateTo(ADMIN_LOGIN_PATH)
  }

  return {
    driver,
    hasDriver: computed(() => Boolean(driver.value)),
    user,
    loggedIn,
    ready,
    signOut,
    publicPaths,
    isPublicPath,
    safeRedirect,
  }
}
