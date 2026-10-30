/**
 * The texts of the 3D components. They show in the admin (the details of a file) and on the
 * public site (a product page), so they follow the admin language in the admin, and the site
 * language on a site page.
 */
export function usePluto3dI18n() {
  const path = useRoute().path
  const inAdmin = path === '/admin' || path.startsWith('/admin/')
  return inAdmin ? usePlutoI18n() : usePlutoSiteI18n()
}
