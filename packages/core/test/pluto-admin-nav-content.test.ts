import type { Ref } from 'vue'
import type { PlutoContentType } from '../shared/types/content'
import type { PlutoExtension, PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { createI18nStub } from './fixtures/i18n-stub'

// Same Nuxt-global stubbing as test/permissions.test.ts and
// test/content-registry.test.ts — see those files for why:
// pluto-admin-nav.ts leans on Nuxt's auto-imported globals (`useNuxtApp`,
// `computed`, `ref`, `useState`) plus two composables this repo's Nuxt
// layer setup normally auto-imports for it (its own sibling composables),
// none of which exist outside a Nuxt build.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}
let stateStore: Map<string, ReturnType<typeof ref>>
let routePath: Ref<string>

beforeEach(() => {
  fakeNuxtApp = {}
  stateStore = new Map()
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
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function contentType(
  name: string,
  overrides: Partial<PlutoContentType> = {}
): PlutoContentType {
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

  const { definePlutoExtension } =
    await import('../app/composables/pluto-extension')
  const { usePlutoContentTypes } =
    await import('../app/composables/pluto-content-types')
  vi.stubGlobal('usePlutoContentTypes', usePlutoContentTypes)

  const { usePlutoPermissions } =
    await import('../app/composables/pluto-permissions')
  vi.stubGlobal('usePlutoPermissions', usePlutoPermissions)

  const { usePlutoSettingsPages } =
    await import('../app/composables/pluto-settings')
  vi.stubGlobal('usePlutoSettingsPages', usePlutoSettingsPages)

  const { usePlutoAdminNav } =
    await import('../app/composables/pluto-admin-nav')

  return {
    usePlutoRegistry,
    definePlutoExtension,
    usePlutoPermissions,
    usePlutoAdminNav,
  }
}

describe('usePlutoAdminNav — registry', () => {
  it('sorts the registered nav items by order', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      nav: [
        { id: 'posts', order: 10, label: 'Posts', to: '/admin/posts' },
        { id: 'pages', order: 5, label: 'Pages', to: '/admin/pages' },
      ],
    })

    const { items } = usePlutoAdminNav()

    expect(items.value.map((item) => item.label)).toEqual(['Pages', 'Posts'])
  })
})

describe('usePlutoAdminNav — labels', () => {
  it('resolves a key label and passes a plain label through', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      nav: [
        { id: 'home', order: 0, label: 'pluto.nav.home', to: '/admin/home' },
        {
          id: 'posts',
          order: 10,
          label: 'Posts',
          to: '/admin/posts',
          children: [{ label: 'pluto.nav.settings', to: '/x' }],
        },
      ],
    })

    const { items } = usePlutoAdminNav()

    expect(items.value.map((item) => item.label)).toEqual(['Home', 'Posts'])
    expect(items.value[1]?.children?.[0]?.label).toBe('Settings')
  })

  it('translates the labels again when the locale changes', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    const locale = ref('en')
    vi.stubGlobal('usePlutoI18n', () => createI18nStub(locale))

    definePlutoExtension({
      id: 'test-layer',
      nav: [{ id: 'home', label: 'pluto.nav.home', to: '/admin/home' }],
    })

    const { items } = usePlutoAdminNav()

    expect(items.value[0]?.label).toBe('Home')

    locale.value = 'pt-BR'

    expect(items.value[0]?.label).toBe('Início')
  })

  it('uses the convention keys of a content type, with the English literal as the fallback', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    const messages: Record<string, string> = {
      'content.post.labelPlural': 'Artigos',
      'content.post.label': 'Artigo',
    }
    vi.stubGlobal('usePlutoI18n', () => ({
      ...createI18nStub(),
      te: (key: string) => key in messages,
      t: (key: string, params?: Record<string, unknown>) =>
        messages[key] ??
        (key === 'pluto.content.all'
          ? `All ${params?.labelPlural}`
          : `Create new ${params?.label}`),
    }))

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        {
          id: 'posts',
          type: contentType('post', { label: 'Post', labelPlural: 'Posts' }),
        },
        {
          id: 'pages',
          type: contentType('page', { label: 'Page', labelPlural: 'Pages' }),
        },
      ],
    })

    const entries = usePlutoAdminNav().items.value

    expect(entries.map((entry) => entry.label)).toEqual(['Artigos', 'Pages'])
    expect(entries[0]?.children?.map((child) => child.label)).toEqual([
      'All Artigos',
      'Create new Artigo',
    ])
  })
})

describe('usePlutoAdminNav — content-type-derived nav entries', () => {
  it('synthesizes a nav entry for an auto-routed content type, with list/create children', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        {
          id: 'posts',
          type: contentType('post', { label: 'Post', labelPlural: 'Posts' }),
        },
      ],
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
      contentTypes: [
        {
          id: 'posts',
          type: contentType('post', { basePath: '/admin/posts' }),
        },
      ],
    })

    const { items } = usePlutoAdminNav()

    const entry = items.value.find((item) => item.id === 'content:post')
    expect(entry?.to).toBe('/admin/posts')
  })

  it('produces no nav entry when autoRoutes is false', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        { id: 'posts', type: contentType('post', { autoRoutes: false }) },
      ],
    })

    const { items } = usePlutoAdminNav()

    expect(
      items.value.find((item) => item.id === 'content:post')
    ).toBeUndefined()
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
    const { definePlutoExtension, usePlutoPermissions, usePlutoAdminNav } =
      await loadComposables()

    definePlutoExtension({
      id: 'test-permissions',
      permissionsDriver: {
        id: 'driver',
        load: async () => ['other:capability'],
      },
    })
    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        {
          id: 'posts',
          type: contentType('post', { capabilities: { read: 'posts:read' } }),
        },
      ],
    })

    await usePlutoPermissions().load()

    const { items } = usePlutoAdminNav()

    expect(
      items.value.find((item) => item.id === 'content:post')
    ).toBeUndefined()
  })

  it('shows the entry once can() grants the declared read capability', async () => {
    const { definePlutoExtension, usePlutoPermissions, usePlutoAdminNav } =
      await loadComposables()

    definePlutoExtension({
      id: 'test-permissions',
      permissionsDriver: { id: 'driver', load: async () => ['posts:read'] },
    })
    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [
        {
          id: 'posts',
          type: contentType('post', { capabilities: { read: 'posts:read' } }),
        },
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
      nav: [
        {
          id: 'settings',
          order: 1000,
          label: 'pluto.nav.settings',
          to: '/admin/settings',
        },
      ],
      settingsPages: [
        {
          id: 'general',
          order: 0,
          label: 'pluto.settings.tabs.general',
          to: '/admin/settings',
        },
      ],
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
      settingsPages: [
        { id: 'users', order: 10, label: 'Users', to: '/admin/settings/users' },
      ],
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
      settingsPages: [
        { id: 'users', label: 'Users', to: '/admin/settings/users' },
      ],
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
      settingsPages: [
        {
          id: 'email',
          label: 'Email',
          to: '/admin/settings/email',
          capability: '*',
        },
      ],
    })
    const { usePlutoPermissions } =
      await import('../app/composables/pluto-permissions')
    await usePlutoPermissions().load()

    expect(usePlutoAdminNav().items.value[0]?.children).toBeUndefined()
  })
})

describe('usePlutoAdminNav — nav groups', () => {
  function layer(
    definePlutoExtension: (definition: PlutoExtension) => void,
    types: PlutoContentType[]
  ) {
    definePlutoExtension({
      id: 'pluto',
      navGroups: [
        { id: 'pages', order: 100, label: 'pluto.nav.pages', icon: 'i-g' },
      ],
    })
    definePlutoExtension({
      id: 'test-layer',
      contentTypes: types.map((type) => ({ id: type.name, type })),
    })
  }

  const doc = contentType('doc', {
    label: 'Doc',
    labelPlural: 'Docs',
    icon: 'i-doc',
    navGroup: 'pages',
  })
  const layout = contentType('layout', {
    label: 'Layout',
    labelPlural: 'Layouts',
    navGroup: 'pluto:pages',
  })
  const post = contentType('post', { label: 'Post', labelPlural: 'Posts' })

  it('makes one item for the types of a group, with one link per type', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    layer(definePlutoExtension, [doc, layout, post])

    const items = usePlutoAdminNav().items.value
    const group = items.find((item) => item.id === 'group:pluto:pages')

    expect(items.map((item) => item.label)).toEqual(['Posts', 'Pages'])
    expect(group?.icon).toBe('i-g')
    expect(group?.to).toBeUndefined()
    expect(group?.children).toEqual([
      { label: 'Docs', to: '/admin/content/doc', icon: 'i-doc' },
      { label: 'Layouts', to: '/admin/content/layout', icon: undefined },
    ])
    expect(items.find((item) => item.id === 'content:doc')).toBeUndefined()
  })

  it('shows a group with one visible type as a normal item', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    layer(definePlutoExtension, [doc, post])

    const ids = usePlutoAdminNav().items.value.map((item) => item.id)

    expect(ids.toSorted()).toEqual(['content:doc', 'content:post'])
  })

  it('counts only the types the user may read', async () => {
    const { definePlutoExtension, usePlutoPermissions, usePlutoAdminNav } =
      await loadComposables()
    definePlutoExtension({
      id: 'test-permissions',
      permissionsDriver: { id: 'driver', load: async () => [] },
    })
    layer(definePlutoExtension, [
      doc,
      { ...layout, capabilities: { read: 'layout:read' } },
    ])
    await usePlutoPermissions().load()

    const ids = usePlutoAdminNav().items.value.map((item) => item.id)

    expect(ids).toEqual(['content:doc'])
  })

  it('shows a type with an unknown group as a normal item', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    layer(definePlutoExtension, [
      { ...doc, navGroup: 'nope' },
      { ...layout, navGroup: 'nope' },
    ])

    const ids = usePlutoAdminNav().items.value.map((item) => item.id)

    expect(ids).toEqual(['content:doc', 'content:layout'])
  })

  it('keeps the group item active on the new and edit pages of its types', async () => {
    const { definePlutoExtension, usePlutoAdminNav } = await loadComposables()
    layer(definePlutoExtension, [
      {
        ...doc,
        newPath: '/admin/doc/new',
        editPath: (id) => `/admin/doc/${id}`,
      },
      layout,
    ])

    const group = usePlutoAdminNav().items.value[0]

    expect(group?.match).toEqual(['/admin/doc/new', '/admin/doc'])
  })
})

describe('definePlutoExtension — navGroups bucket', () => {
  it('registers the groups of an extension, sorted by order, and replaces them on a second call', async () => {
    const { definePlutoExtension, usePlutoRegistry } = await loadComposables()

    definePlutoExtension({
      id: 'a',
      navGroups: [{ id: 'late', order: 50, label: 'Late' }],
    })
    definePlutoExtension({
      id: 'b',
      navGroups: [{ id: 'early', order: 10, label: 'Early' }],
    })

    expect(usePlutoRegistry().navGroups.list.value.map((g) => g.id)).toEqual([
      'b:early',
      'a:late',
    ])

    definePlutoExtension({ id: 'a' })

    expect(usePlutoRegistry().navGroups.list.value.map((g) => g.id)).toEqual([
      'b:early',
    ])
  })
})
