import { guardDecision, isAdminPath, matchPublicPath, staffDecision } from '../composables/internal/admin-shell'

/**
 * The route guard of the admin. It does nothing when no auth driver is
 * registered, so a backend with its own guard (supabase 0.10) is not affected.
 * It never touches a path outside `/admin`. A signed-out user on a private
 * admin path goes to the login page. A signed-in user on a public auth path
 * goes to the admin home. The driver's own `guard` runs first, so a backend
 * can send the user somewhere else (supabase: the first setup). Then a signed-in
 * user on a private path must be staff (at least one capability, or no
 * permissions driver). Other users go to `/admin/no-access`. The public auth
 * paths and the no-access page are never sent to it, so there is no loop. The
 * server still checks every request: this only decides what the browser shows.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = usePlutoAuth()
  if (!auth.hasDriver.value || !isAdminPath(to.path)) {
    return
  }

  try {
    await auth.ready()
  } catch {
    // A driver must not reject. If it does, treat the user as signed out.
  }

  const driverGuard = auth.driver.value?.guard
  if (driverGuard) {
    let target: string | undefined | void
    try {
      target = await driverGuard({ path: to.path, fullPath: to.fullPath, query: to.query })
    } catch {
      // A driver guard must not reject. If it does, go on with the sign-in rule.
    }
    if (target && target !== to.path && target !== to.fullPath) {
      return navigateTo(target, { replace: true })
    }
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

  // The staff step. A signed-out user and a public auth path are done above.
  const publicPaths = auth.publicPaths.value
  if (!auth.loggedIn.value || matchPublicPath(to.path, publicPaths)) {
    return
  }
  const permissions = usePlutoPermissions()
  let loadFailed = false
  if (permissions.hasDriver.value) {
    try {
      await permissions.ensureLoaded(auth.user.value?.id ?? '')
    } catch {
      loadFailed = true
    }
  }
  const staff = staffDecision({
    path: to.path,
    fullPath: to.fullPath,
    query: to.query,
    publicPaths,
    hasDriver: permissions.hasDriver.value,
    granted: permissions.granted.value,
    loadFailed,
  })
  if (staff.action === 'redirect') {
    return navigateTo(staff.to, { replace: true })
  }
})
