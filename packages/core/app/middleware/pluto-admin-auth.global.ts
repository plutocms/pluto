import {
  driverDecision,
  guardDecision,
  matchPublicPath,
  staffDecision,
} from '../composables/internal/admin-shell'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = usePlutoAuth()
  const driver = driverDecision({
    path: to.path,
    hasDriver: auth.hasDriver.value,
    dev: import.meta.dev,
  })
  if (driver) {
    return driver.action === 'redirect'
      ? navigateTo(driver.to, { replace: true })
      : undefined
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
      target = await driverGuard({
        path: to.path,
        fullPath: to.fullPath,
        query: to.query,
      })
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
