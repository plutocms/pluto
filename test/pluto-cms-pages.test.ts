import type { PlutoCmsPageLike } from '../modules/pluto-cms/pages'
import { describe, expect, it } from 'vitest'
import { applyAdminLayout } from '../modules/pluto-cms/pages'

describe('applyAdminLayout', () => {
  it('puts admin pages on the admin layout and leaves the others', () => {
    const pages: PlutoCmsPageLike[] = [
      { path: '/' },
      { path: '/posts/:slug()' },
      { path: '/admin/home' },
      { path: '/admin/content/:type()/:id()' },
      { path: '/admin' },
      { path: '/administrator' },
    ]
    applyAdminLayout(pages)

    expect(pages.map((page) => page.meta?.layout)).toEqual([undefined, undefined, 'admin', 'admin', 'admin', undefined])
  })

  it('skips the login page and keeps a layout a page already sets', () => {
    const pages: PlutoCmsPageLike[] = [
      { path: '/admin/login' },
      { path: '/admin/print', meta: { layout: 'blank' } },
    ]
    applyAdminLayout(pages)

    expect(pages[0]!.meta?.layout).toBeUndefined()
    expect(pages[1]!.meta?.layout).toBe('blank')
  })

  it('follows nested routes with relative child paths', () => {
    const pages: PlutoCmsPageLike[] = [
      { path: '/admin', meta: { layout: 'admin' }, children: [{ path: 'home' }, { path: 'login' }] },
    ]
    applyAdminLayout(pages)

    expect(pages[0]!.children![0]!.meta?.layout).toBe('admin')
    expect(pages[0]!.children![1]!.meta?.layout).toBeUndefined()
  })
})
