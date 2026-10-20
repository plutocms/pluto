/** The part of a Nuxt page that the layout rule reads and writes. */
export interface PlutoCmsPageLike {
  path: string
  meta?: Record<string, unknown>
  children?: PlutoCmsPageLike[]
}

/** The admin route and every route under it. */
function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/')
}

/** The full path of a page. A child path without a leading `/` is relative to its parent. */
function fullPath(path: string, parentPath: string): string {
  if (path.startsWith('/')) {
    return path
  }
  const parent = parentPath.replace(/\/+$/, '')
  return path === '' ? parent || '/' : `${parent}/${path}`
}

/**
 * Puts every admin page on the `admin` layout. In a supabase app, the
 * supabase layer's `pages/admin.vue` parent route does this. The standalone
 * CMS has no such parent route, so the module sets the layout on each page.
 *
 * - A page that already sets a layout keeps it.
 * - `/admin/login` is skipped. The CMS login page uses the `auth` layout.
 */
export function applyAdminLayout(pages: PlutoCmsPageLike[], parentPath = ''): void {
  for (const page of pages) {
    const path = fullPath(page.path, parentPath)
    if (isAdminPath(path) && path !== '/admin/login' && page.meta?.layout === undefined) {
      page.meta = { ...page.meta, layout: 'admin' }
    }
    if (page.children?.length) {
      applyAdminLayout(page.children, path)
    }
  }
}
