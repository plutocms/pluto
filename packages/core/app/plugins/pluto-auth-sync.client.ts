import {
  ADMIN_BAR_HINT_COOKIE,
  isStaff,
} from '../composables/internal/admin-shell'

const HINT_MAX_AGE = 60 * 60 * 24 * 30

export default defineNuxtPlugin({
  name: 'pluto-auth-sync',
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

    const driverReady = ref(false)
    Promise.resolve(auth.ready())
      .catch(() => {})
      .finally(() => {
        driverReady.value = true
      })

    const mounted = usePlutoAppMounted()
    // A bar that shows in the first client render but not in the server HTML is a hydration mismatch.
    if (nuxtApp.isHydrating) {
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => {
        mounted.value = true
      })
    } else {
      mounted.value = true
    }

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
          await permissions.ensureLoaded(user.value?.id ?? '')
          known.value =
            loggedIn.value &&
            (!permissions.hasDriver.value || permissions.loaded.value)
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

    watch(
      [settled, loggedIn, known, permissions.granted, permissions.hasDriver],
      () => {
        if (!settled.value) {
          return
        }
        const staff =
          loggedIn.value &&
          known.value &&
          isStaff(permissions.hasDriver.value, permissions.granted.value)
        const next = staff ? true : null
        if (hintCookie.value !== next) {
          hintCookie.value = next
        }
      },
      { immediate: true }
    )
  },
})
