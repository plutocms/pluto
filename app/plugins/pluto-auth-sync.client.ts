import { ADMIN_BAR_HINT_COOKIE, isStaff } from '../composables/internal/admin-shell'

/** Seconds that the admin bar hint lives. When it expires, the next visit of staff writes it again. */
const HINT_MAX_AGE = 60 * 60 * 24 * 30

/**
 * Keeps the capabilities and the admin language in step with the session of
 * the auth driver. App-wide, so a public page knows them too.
 *
 * - Signed in: loads the capabilities, then the stored admin language.
 * - Signed out: clears the capabilities.
 *
 * It also writes the "capabilities known" and the "settled" states. The
 * public-page admin bar waits for them, so a shop customer never sees the bar.
 * Client-only on purpose: the server never knows the capabilities, so the
 * states stay false there. With no permissions driver, there is nothing to
 * load, and the capabilities are known at once.
 *
 * Once the session is settled, it writes the admin bar hint cookie: set for a
 * confirmed staff user, removed for anybody else. The server reads it to put
 * the bar in the first paint. See `usePlutoAdminBar`.
 */
export default defineNuxtPlugin({
  name: 'pluto-auth-sync',
  // It reads the admin language, so the locale state must be resolved first.
  dependsOn: ['pluto-i18n'],
  setup(nuxtApp) {
    const auth = usePlutoAuth()
    const { loggedIn, user } = auth
    const permissions = usePlutoPermissions()
    const { syncUserLocale } = usePlutoI18n()
    const known = usePlutoCapabilitiesKnown()
    const settled = usePlutoAuthSettled()
    const hintCookie = useCookie<boolean | null>(ADMIN_BAR_HINT_COOKIE, {
      path: '/',
      sameSite: 'lax',
      maxAge: HINT_MAX_AGE,
      default: () => null,
    })

    // The driver reads the session after this plugin runs. Until it is ready, a
    // signed-out state can mean "not read yet".
    const driverReady = ref(false)
    Promise.resolve(auth.ready()).catch(() => {}).finally(() => {
      driverReady.value = true
    })

    // The public-page bar waits for the mount too. The session and the
    // capabilities can be ready before hydration (no permissions driver, or a
    // fast session read). A bar, or an app offset, that shows in the first
    // client render but not in the server HTML is a hydration mismatch.
    const mounted = usePlutoAppMounted()
    if (nuxtApp.isHydrating) {
      // 'app:mounted' fires before async pages and layouts hydrate. Wait for
      // the first Suspense resolve, where Nuxt ends the hydration.
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
        mounted.value = true
      })
    } else {
      mounted.value = true
    }

    // The permissions driver can register after this plugin runs, so watch it too.
    watch(
      [loggedIn, permissions.hasDriver],
      async ([current]) => {
        if (!current) {
          permissions.clear()
          known.value = false
          settled.value = driverReady.value
          return
        }

        known.value = false
        settled.value = false
        void syncUserLocale()
        try {
          // The route guard shares this request through `ensureLoaded`.
          await permissions.ensureLoaded(user.value?.id ?? '')
          // Ignore a result that arrives after a sign-out.
          known.value = loggedIn.value && (!permissions.hasDriver.value || permissions.loaded.value)
        } catch {
          known.value = false
        } finally {
          if (loggedIn.value) {
            settled.value = true
          }
        }
      },
      { immediate: true }
    )

    watch(driverReady, (ready) => {
      if (ready && !loggedIn.value) {
        settled.value = true
      }
    })

    // Keep the hint in step with what the browser checked.
    watch(
      [settled, loggedIn, known, permissions.granted, permissions.hasDriver],
      () => {
        if (!settled.value) {
          return
        }
        const staff = loggedIn.value && known.value && isStaff(permissions.hasDriver.value, permissions.granted.value)
        const next = staff ? true : null
        if (hintCookie.value !== next) {
          hintCookie.value = next
        }
      },
      { immediate: true }
    )
  },
})
