import type { PlutoContentType } from '../shared/types/content'
import type { PlutoNavItem } from '../shared/types/registry'
import { describe, expect, it } from 'vitest'
import {
  activeNavGroups,
  contentTypeMatches,
  isPathWithin,
  nextOpenGroups,
} from '../app/composables/internal/admin-menu'

const products: PlutoNavItem = {
  id: 'shop:products',
  label: 'Products',
  to: '/admin/products',
  children: [
    { label: 'New', to: '/admin/product/new' },
    { label: 'All', to: '/admin/products' },
  ],
}
const settings: PlutoNavItem = {
  id: 'pluto:settings',
  label: 'Settings',
  to: '/admin/settings',
  children: [
    { label: 'General', to: '/admin/settings' },
    { label: 'Mail', to: '/admin/settings/mail' },
  ],
}
const home: PlutoNavItem = {
  id: 'pluto:home',
  label: 'Home',
  to: '/admin/home',
}
const items = [home, products, settings]

describe('isPathWithin', () => {
  it('matches the path and the pages below it, not a longer name', () => {
    expect(isPathWithin('/admin/products', '/admin/products')).toBe(true)
    expect(isPathWithin('/admin/products/1', '/admin/products')).toBe(true)
    expect(isPathWithin('/admin/products-old', '/admin/products')).toBe(false)
    expect(isPathWithin('/admin/products', undefined)).toBe(false)
  })
})

describe('activeNavGroups', () => {
  it('finds the group of the item, of a child and of a match path', () => {
    expect(activeNavGroups(items, '/admin/products')).toEqual(['shop:products'])
    expect(activeNavGroups(items, '/admin/product/new')).toEqual([
      'shop:products',
    ])
    expect(activeNavGroups(items, '/admin/settings/mail')).toEqual([
      'pluto:settings',
    ])
    expect(activeNavGroups(items, '/admin/product/edit/7')).toEqual([])
    expect(
      activeNavGroups(
        [{ ...products, match: ['/admin/product/edit'] }],
        '/admin/product/edit/7'
      )
    ).toEqual(['shop:products'])
  })

  it('skips an item without children', () => {
    expect(activeNavGroups(items, '/admin/home')).toEqual([])
  })
})

describe('nextOpenGroups', () => {
  it('opens the active group and the new defaultOpen groups', () => {
    const withDefault = [home, products, { ...settings, defaultOpen: true }]
    expect(
      nextOpenGroups(
        [],
        withDefault,
        '/admin/products',
        new Set(),
        false
      ).sort()
    ).toEqual(['pluto:settings', 'shop:products'])
  })

  it('keeps a group closed that the user closed, until the next navigation', () => {
    const known = new Set(items.map((item) => item.id))
    expect(nextOpenGroups([], items, '/admin/products', known, false)).toEqual(
      []
    )
    expect(nextOpenGroups([], items, '/admin/products', known, true)).toEqual([
      'shop:products',
    ])
  })

  it('keeps the open groups', () => {
    const known = new Set(items.map((item) => item.id))
    expect(
      nextOpenGroups(['pluto:settings'], items, '/admin/products', known, true)
    ).toEqual(['pluto:settings', 'shop:products'])
  })
})

describe('contentTypeMatches', () => {
  const type = {
    name: 'product',
    basePath: '/admin/products',
    newPath: '/admin/product/new',
    editPath: (id: string | number) => `/admin/product/edit/${id}`,
  } as PlutoContentType

  it('gives the new and edit pages of a type at the item path', () => {
    expect(contentTypeMatches(products, [type])).toEqual([
      '/admin/product/new',
      '/admin/product/edit',
    ])
  })

  it('gives nothing for another path', () => {
    expect(contentTypeMatches(settings, [type])).toEqual([])
  })
})
