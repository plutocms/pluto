import { defineNuxtRouteMiddleware, navigateTo } from '#imports'
import { usePlutoCmsSession } from '../composables/pluto-cms-session'

const LOGIN_PATH = '/admin/login'

/**
 * Global route middleware. The module adds it only when the CMS is on.
 * A signed-out user on `/admin/**` goes to the login page. A signed-in user
 * on the login page goes to the dashboard. The server still checks every
 * request: this only decides what the browser shows.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const inAdmin = to.path === '/admin' || to.path.startsWith('/admin/')
  // `/admin/**` is client-only, so this runs in the browser.
  if (import.meta.server || !inAdmin) {
    return
  }

  const session = usePlutoCmsSession()
  await session.ready()

  if (to.path === LOGIN_PATH) {
    return session.loggedIn.value ? navigateTo('/admin/home') : undefined
  }
  if (!session.loggedIn.value) {
    return navigateTo({ path: LOGIN_PATH, query: { redirect: to.fullPath } })
  }
})
