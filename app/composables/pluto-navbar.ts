import { ADMIN_BAR_HINT_COOKIE, isStaff, navbarVisible } from './internal/admin-shell'

/**
 * The admin navbar shell (the whole top bar, provided by a backend layer).
 * Reads the new registry and falls back to the old `useNavbarAdmin`
 * composable (`@plutocms/utils`) when no layer has migrated yet. The legacy
 * ref is read inside this `computed`, not once at setup, so a navbar
 * registered after this composable first runs is never lost.
 */
export function usePlutoNavbarShell() {
  const registry = usePlutoRegistry()
  const legacy = useNavbarAdmin()

  const component = computed<Component | null>(() => {
    const registered = registry.navbarShell.list.value
    const winner = registered.at(-1) // highest-order wins; ties go to most recent
    return winner?.component ?? legacy.navbar.value ?? null
  })

  return { component }
}

/**
 * The small action buttons rendered inside the navbar. Merges the new
 * registry with the old `useNavbarAdminActions` composable
 * (`@plutocms/utils`), so an unmigrated layer's actions keep showing up.
 */
export function usePlutoNavbarActions() {
  const registry = usePlutoRegistry()
  const legacy = useNavbarAdminActions()

  const items = computed<PlutoNavbarAction[]>(() => [
    ...registry.navbarActions.list.value,
    ...legacy.actions.value.map((component, index) => ({
      id: `legacy:navbar-action-${index}`,
      order: 500,
      component,
    })),
  ])

  return { items }
}

/**
 * Whether the core admin bar shows now. The provider uses the same rule, so an
 * app that offsets its own header can follow it.
 *
 * - On `/admin/**`: a signed-in user, except on the public auth paths.
 * - On a public page: staff only (at least one capability, or '*'), after the
 *   capabilities finished loading in the browser. This keeps a shop customer
 *   from seeing the bar. Before that, the hint cookie decides: a browser that
 *   showed the bar to staff before gets the bar in the server HTML, so it is
 *   in the first paint. The hint state goes into the payload, so the first
 *   client render matches the server HTML. A wrong hint (the session ended)
 *   hides the bar once the session is known.
 *
 * With no permissions driver, every signed-in user counts as staff, like
 * `can()` that fails open.
 *
 * A route hides the bar with the page meta `plutoAdminBar: false`. The preview
 * path (`isPlutoPreviewPath`) hides it too.
 *
 * `confirmed` is true only for a staff user that the browser checked. Use it
 * for links that must not show from the hint alone.
 */
export function usePlutoAdminBar() {
  const route = useRoute()
  const { loggedIn, publicPaths } = usePlutoAuth()
  const permissions = usePlutoPermissions()
  const capabilitiesKnown = usePlutoCapabilitiesKnown()
  const mounted = usePlutoAppMounted()
  const settled = usePlutoAuthSettled()
  const hint = usePlutoAdminBarHint()

  const staff = computed(() => isStaff(permissions.hasDriver.value, permissions.granted.value))
  // The public-page rule also waits for the mount, so the first client render
  // matches the server HTML. The admin rule does not read it.
  const known = computed(() => capabilitiesKnown.value && mounted.value)
  const hiddenByRoute = computed(() => route.meta.plutoAdminBar === false || isPlutoPreviewPath(route.path))

  const visible = computed(() =>
    navbarVisible({
      path: route.path,
      loggedIn: loggedIn.value,
      isStaff: staff.value,
      capabilitiesKnown: known.value,
      publicPaths: publicPaths.value,
      hiddenByRoute: hiddenByRoute.value,
      hint: hint.value && !(mounted.value && settled.value),
    })
  )

  const confirmed = computed(() => !hiddenByRoute.value && loggedIn.value && known.value && staff.value)

  return { visible, confirmed }
}

/**
 * The hint for the public-page admin bar, read from the request cookie on the
 * server. It goes to the browser in the payload. A page rendered in the
 * browser only (no server HTML) starts with false.
 */
export function usePlutoAdminBarHint() {
  return useState<boolean>('pluto-admin-bar-hint', () =>
    import.meta.server ? useCookie<boolean | null>(ADMIN_BAR_HINT_COOKIE, { readonly: true }).value === true : false)
}

/**
 * The extra items of the user menu, from every layer, sorted by `order`. The
 * label resolves with `tx()` inside the `computed`, so a language switch
 * updates it.
 */
export function usePlutoAccountMenu() {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()

  const items = computed<PlutoAccountMenuItem[]>(() =>
    registry.accountMenu.list.value.map((item) => ({ ...item, label: tx(item.label) }))
  )

  return { items }
}

/**
 * The name and the URL of the public site. A backend gives its own values
 * through the `site` field of `definePlutoExtension`. For each field, the last
 * registered site with a value wins.
 */
export function usePlutoSiteInfo() {
  const registry = usePlutoRegistry()

  function pick(field: 'name' | 'url'): string | undefined {
    for (const entry of registry.siteInfo.list.value.toReversed()) {
      const value = entry[field]?.()
      if (value) {
        return value
      }
    }
    return undefined
  }

  return {
    name: computed(() => pick('name')),
    url: computed(() => pick('url')),
  }
}
