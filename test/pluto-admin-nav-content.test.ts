import type { Ref } from 'vue'
import type { PlutoContentType } from '../shared/types/content'
import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

// A minimal stand-in for `@plutocms/utils`' own `NavigationMenuItem`, just
// the fields `usePlutoAdminNav`'s legacy bridge reads.
interface LegacyActionChild {
  label?: string
  href?: string
}

interface LegacyAction {
  label?: string
  href?: string
  defaultOpen?: boolean
  icon?: string
  children?: LegacyActionChild[]
}

// Same Nuxt-global stubbing as test/permissions.test.ts and
// test/content-registry.test.ts — see those files for why:
// pluto-admin-nav.ts leans on Nuxt's auto-imported globals (`useNuxtApp`,
// `computed`, `ref`, `useState`) plus two composables this repo's Nuxt
// layer setup normally auto-imports for it (`useSidebarAdminActions` from
// `@plutocms/utils`, and its own sibling composables), none of which exist
// outside a Nuxt build.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}
let stateStore: Map<string, ReturnType<typeof ref>>
let legacyActions: Ref<LegacyAction[]>

beforeEach(() => {
  fakeNuxtApp = {}
  stateStore = new Map()
  legacyActions = ref<LegacyAction[]>([])

  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useState', <T>(key: string, init: () => T) => {
    if (!stateStore.has(key)) {
      stateStore.set(key, ref(init()))
    }
    return stateStore.get(key)
  })
  vi.stubGlobal('useSidebarAdminActions', () => ({
    actions: legacyActions,
    addAction: (action: LegacyAction[]) => {
      legacyActions.value = [...legacyActions.value, ...action]
    },
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function contentType(name: string, overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name,
    label: name,
    labelPlural: `${name}s`,
    source: name,
    titleField: 'title',
    fields: [{ name: 'title', type: 'text', label: 'Title' }],
    ...overrides,
  }
}

async function loadComposables() {
  const { usePlutoRegistry } = await import('../app/composables/pluto-registry')
  vi.stubGlobal('usePlutoRegistry', usePlutoRegistry)

  const { definePlutoExtension } = await import('../app/composables/pluto-extension')
  const { usePlutoContentTypes } = await import('../app/composables/pluto-content-types')
  vi.stubGlobal('usePlutoContentTypes', usePlutoContentTypes)

  const { usePlutoPermissions } = await import('../app/composables/pluto-permissions')
  vi.stubGlobal('usePlutoPermissions', usePlutoPermissions)

  const { usePlutoAdminNav } = await import('../app/composables/pluto-admin-nav')

  return { usePlutoRegistry, definePlutoExtension, usePlutoPermissions, usePlutoAdminNav }
}

describe('usePlutoAdminNav — pre-existing registry + legacy-bridge merge (regression check)', () => {
  it('merges a registered nav item with a bridged legacy item, sorted by order', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      nav: [{ id: 'posts', order: 10, label: 'Posts', to: '/admin/posts' }],
    })
    legacyActions.value = [{ label: 'Legacy item', href: '/admin/legacy' }]

    const { items } = usePlutoAdminNav()

    expect(items.value.map((item) => item.label)).toEqual(['Posts', 'Legacy item'])
  })

  it('skips a bridged legacy item whose label already matches a registered item', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      nav: [{ id: 'posts', label: 'Posts', to: '/admin/posts' }],
    })
    legacyActions.value = [{ label: 'Posts', href: '/admin/posts-legacy' }]

    const { items } = usePlutoAdminNav()

    expect(items.value).toHaveLength(1)
    expect(items.value[0]?.to).toBe('/admin/posts')
  })
})

describe('usePlutoAdminNav — content-type-derived nav entries', () => {
  it('synthesizes a nav entry for an auto-routed content type, with list/create children', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [{ id: 'posts', type: contentType('post', { label: 'Post', labelPlural: 'Posts' }) }],
    })

    const { items } = usePlutoAdminNav()

    const entry = items.value.find((item) => item.id === 'content:post')
    expect(entry).toBeDefined()
    expect(entry?.to).toBe('/admin/content/post')
    expect(entry?.label).toBe('Posts')
    expect(entry?.children).toEqual([
      { label: 'All Posts', to: '/admin/content/post' },
      { label: 'Create new Post', to: '/admin/content/post/new' },
    ])
  })

  it('honors a custom basePath', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [{ id: 'posts', type: contentType('post', { basePath: '/admin/posts' }) }],
    })

    const { items } = usePlutoAdminNav()

    const entry = items.value.find((item) => item.id === 'content:post')
    expect(entry?.to).toBe('/admin/posts')
  })

  it('produces no nav entry when autoRoutes is false', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [{ id: 'posts', type: contentType('post', { autoRoutes: false }) }],
    })

    const { items } = usePlutoAdminNav()

    expect(items.value.find((item) => item.id === 'content:post')).toBeUndefined()
  })

  it('shows the entry when the content type declares no read capability at all', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [{ id: 'posts', type: contentType('post') }],
    })

    const { items } = usePlutoAdminNav()

    expect(items.value.find((item) => item.id === 'content:post')).toBeDefined()
  })

  it('hides the entry when can() returns false for a declared read capability', async () => {
    const { definePlutoExtension, usePlutoPermissions, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-permissions',
      permissionsDriver: { id: 'driver', load: async () => ['other:capability'] },
    })
    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        { id: 'posts', type: contentType('post', { capabilities: { read: 'posts:read' } }) },
      ],
    })

    await usePlutoPermissions().load()

    const { items } = usePlutoAdminNav()

    expect(items.value.find((item) => item.id === 'content:post')).toBeUndefined()
  })

  it('shows the entry once can() grants the declared read capability', async () => {
    const { definePlutoExtension, usePlutoPermissions, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-permissions',
      permissionsDriver: { id: 'driver', load: async () => ['posts:read'] },
    })
    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        { id: 'posts', type: contentType('post', { capabilities: { read: 'posts:read' } }) },
      ],
    })

    await usePlutoPermissions().load()

    const { items } = usePlutoAdminNav()

    expect(items.value.find((item) => item.id === 'content:post')).toBeDefined()
  })
})
