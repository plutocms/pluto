/**
 * Keeps the capabilities and the admin language in step with the session of
 * the auth driver. App-wide, so a public page knows them too.
 *
 * - Signed in: loads the capabilities, then the stored admin language.
 * - Signed out: clears the capabilities.
 *
 * It also writes the "capabilities known" state. The public-page admin bar
 * waits for it, so a shop customer never sees the bar. Client-only on purpose:
 * the server never knows the capabilities, so the state stays false there.
 * With no permissions driver, there is nothing to load, and the state is true.
 */
export default defineNuxtPlugin(() => {
  const { loggedIn } = usePlutoAuth()
  const permissions = usePlutoPermissions()
  const { syncUserLocale } = usePlutoI18n()
  const known = usePlutoCapabilitiesKnown()

  // The permissions driver can register after this plugin runs, so watch it too.
  watch(
    [loggedIn, permissions.hasDriver],
    async ([current]) => {
      if (!current) {
        permissions.clear()
        known.value = false
        return
      }

      known.value = false
      void syncUserLocale()
      try {
        await permissions.load()
        // Ignore a result that arrives after a sign-out.
        known.value = loggedIn.value && (!permissions.hasDriver.value || permissions.loaded.value)
      } catch {
        known.value = false
      }
    },
    { immediate: true }
  )
})
