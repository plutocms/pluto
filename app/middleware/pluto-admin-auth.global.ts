import { guardDecision } from '../composables/internal/admin-shell'

/**
 * The route guard of the admin. It does nothing when no auth driver is
 * registered, so a backend with its own guard (supabase 0.10) is not affected.
 * It never touches a path outside `/admin`. A signed-out user on a private
 * admin path goes to the login page. A signed-in user on a public auth path
 * goes to the admin home. The server still checks every request: this only
 * decides what the browser shows.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = usePlutoAuth()
  if (!auth.hasDriver.value) {
    return
  }

  try {
    await auth.ready()
  } catch {
    // A driver must not reject. If it does, treat the user as signed out.
  }

  const decision = guardDecision({
    path: to.path,
    fullPath: to.fullPath,
    query: to.query,
    loggedIn: auth.loggedIn.value,
    publicPaths: auth.publicPaths.value,
  })
  if (decision.action === 'redirect') {
    return navigateTo(decision.to, { replace: true })
  }
})
