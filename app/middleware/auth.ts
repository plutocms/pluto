export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn, logout } = useAuth()

  if (
    isLoggedIn.value &&
    (to.path === '/admin/login' || to.path === '/admin/signup')
  ) {
    return navigateTo(
      to.query.redirect
        ? decodeURIComponent(to.query.redirect as string)
        : '/admin/home'
    )
  }

  if (
    !isLoggedIn.value &&
    to.path.startsWith('/admin') &&
    to.path !== '/admin/signup' &&
    to.path !== '/admin/login'
  ) {
    if (from.query.redirect) {
      logout({ redirectTo: from.query.redirect as string, showToast: true })
    } else {
      logout()
    }
  }
})
