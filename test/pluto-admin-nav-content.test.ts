import type { Ref } from 'vue'
import type { PlutoContentType } from '../shared/types/content'
import type { PlutoExtension, PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { createI18nStub } from './fixtures/i18n-stub'

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
let routePath: Ref<string>

beforeEach(() => {
  fakeNuxtApp = {}
  stateStore = new Map()
  legacyActions = ref<LegacyAction[]>([])
  routePath = ref('/admin/home')

  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('usePlutoI18n', () => createI18nStub())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useState', <T>(key: string, init: () => T) => {
    if (!stateStore.has(key)) {
      stateStore.set(key, ref(init()))
    }
    return stateStore.get(key)
  })
  vi.stubGlobal('useRoute', () => reactive({ path: routePath }))
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

  const { usePlutoSettingsPages } = await import('../app/composables/pluto-settings')
  vi.stubGlobal('usePlutoSettingsPages', usePlutoSettingsPages)

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

describe('usePlutoAdminNav — labels', () => {
  it('resolves a key label and passes a plain label through', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      nav: [
        { id: 'home', order: 0, label: 'pluto.nav.home', to: '/admin/home' },
        { id: 'posts', order: 10, label: 'Posts', to: '/admin/posts', children: [{ label: 'pluto.nav.settings', to: '/x' }] },
      ],
    })

    const { items } = usePlutoAdminNav()

    expect(items.value.map((item) => item.label)).toEqual(['Home', 'Posts'])
    expect(items.value[1]?.children?.[0]?.label).toBe('Settings')
  })

  it('compares the raw labels in the legacy dedupe, before it resolves the keys', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      nav: [{ id: 'home', label: 'pluto.nav.home', to: '/admin/home' }],
    })
    // The legacy item uses the resolved text, which does not match the raw key.
    legacyActions.value = [{ label: 'Home', href: '/admin/legacy-home' }]

    const { items } = usePlutoAdminNav()

    expect(items.value.map((item) => item.to)).toEqual(['/admin/home', '/admin/legacy-home'])
  })

  it('translates the labels again when the locale changes', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    const locale = ref('en')
    vi.stubGlobal('usePlutoI18n', () => createI18nStub(locale))

    definePlutoExtension({ id: 'test-layer', nav: [{ id: 'home', label: 'pluto.nav.home', to: '/admin/home' }] })

    const { items } = usePlutoAdminNav()

    expect(items.value[0]?.label).toBe('Home')

    locale.value = 'pt-BR'

    expect(items.value[0]?.label).toBe('Início')
  })

  it('uses the convention keys of a content type, with the English literal as the fallback', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    const messages: Record<string, string> = { 'content.post.labelPlural': 'Artigos', 'content.post.label': 'Artigo' }
    vi.stubGlobal('usePlutoI18n', () => ({
      ...createI18nStub(),
      te: (key: string) => key in messages,
      t: (key: string, params?: Record<string, unknown>) =>
        messages[key] ?? (key === 'pluto.content.all' ? `All ${params?.labelPlural}` : `Create new ${params?.label}`),
    }))

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        { id: 'posts', type: contentType('post', { label: 'Post', labelPlural: 'Posts' }) },
        { id: 'pages', type: contentType('page', { label: 'Page', labelPlural: 'Pages' }) },
      ],
    })

    const entries = usePlutoAdminNav().items.value

    expect(entries.map((entry) => entry.label)).toEqual(['Artigos', 'Pages'])
    expect(entries[0]?.children?.map((child) => child.label)).toEqual(['All Artigos', 'Create new Artigo'])
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

describe('usePlutoAdminNav — Settings children', () => {
  function core(definePlutoExtension: (definition: PlutoExtension) => void) {
    definePlutoExtension({
      id: 'pluto',
      nav: [{ id: 'settings', order: 1000, label: 'pluto.nav.settings', to: '/admin/settings' }],
      settingsPages: [{ id: 'general', order: 0, label: 'pluto.settings.tabs.general', to: '/admin/settings' }],
    })
  }

  it('keeps Settings a plain link with one settings page', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    core(definePlutoExtension)

    const settings = usePlutoAdminNav().items.value[0]

    expect(settings?.label).toBe('Settings')
    expect(settings?.children).toBeUndefined()
  })

  it('adds one child per visible settings page with two or more', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    core(definePlutoExtension)
    definePlutoExtension({
      id: 'test-layer',
      settingsPages: [{ id: 'users', order: 10, label: 'Users', to: '/admin/settings/users' }],
    })

    const settings = usePlutoAdminNav().items.value[0]

    expect(settings?.children).toEqual([
      { label: 'General', to: '/admin/settings' },
      { label: 'Users', to: '/admin/settings/users' },
    ])
    expect(settings?.defaultOpen).toBe(false)
  })

  it('opens the Settings item by default on a settings route', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    core(definePlutoExtension)
    definePlutoExtension({
      id: 'test-layer',
      settingsPages: [{ id: 'users', label: 'Users', to: '/admin/settings/users' }],
    })
    routePath.value = '/admin/settings/users'

    expect(usePlutoAdminNav().items.value[0]?.defaultOpen).toBe(true)
  })

  it('leaves out a page the user may not see, and drops the children below two', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    core(definePlutoExtension)
    definePlutoExtension({
      id: 'test-layer',
      permissionsDriver: { id: 'driver', load: async () => ['posts:read'] },
      settingsPages: [{ id: 'email', label: 'Email', to: '/admin/settings/email', capability: '*' }],
    })
    const { usePlutoPermissions } = await import('../app/composables/pluto-permissions')
    await usePlutoPermissions().load()

    expect(usePlutoAdminNav().items.value[0]?.children).toBeUndefined()
  })
})
