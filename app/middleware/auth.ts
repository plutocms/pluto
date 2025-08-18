export default defineNuxtRouteMiddleware((to) => {
  const { user } = useAuth()

  if (
    user.value &&
    (to.path === '/admin/login' || to.path === '/admin/signup')
  ) {
    return navigateTo('/admin/home')
  }

  if (
    user.value &&
    (to.path === '/admin/login' || to.path === '/admin/signup')
  ) {
    return navigateTo('/admin/home')
  }

  if (
    !user.value &&
    to.path.startsWith('/admin/') &&
    to.path !== '/admin/signup' &&
    to.path !== '/admin/login'
  ) {
    return navigateTo('/admin/login')
  }
})
