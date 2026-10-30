import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { createI18nStub } from './fixtures/i18n-stub'

// Same Nuxt-global stubbing as test/permissions.test.ts. `useRoute` is a
// reactive object whose `path` a test changes through `routePath`.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}
let stateStore: Map<string, ReturnType<typeof ref>>
let routePath: ReturnType<typeof ref<string>>

beforeEach(() => {
  fakeNuxtApp = {}
  stateStore = new Map()
  routePath = ref('/admin/settings')

  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('usePlutoI18n', () => createI18nStub())
  vi.stubGlobal('useRoute', () => reactive({ path: routePath }))
  vi.stubGlobal('useState', <T>(key: string, init: () => T) => {
    if (!stateStore.has(key)) {
      stateStore.set(key, ref(init()))
    }
    return stateStore.get(key)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadComposables() {
  const { usePlutoRegistry } = await import('../app/composables/pluto-registry')
  vi.stubGlobal('usePlutoRegistry', usePlutoRegistry)

  const { definePlutoExtension } =
    await import('../app/composables/pluto-extension')
  const { usePlutoPermissions } =
    await import('../app/composables/pluto-permissions')
  vi.stubGlobal('usePlutoPermissions', usePlutoPermissions)
  const { usePlutoSettingsPages } =
    await import('../app/composables/pluto-settings')

  return { definePlutoExtension, usePlutoPermissions, usePlutoSettingsPages }
}

describe('usePlutoSettingsPages', () => {
  it('sorts the pages by order and resolves a key label', async () => {
    const { definePlutoExtension, usePlutoSettingsPages } =
      await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      settingsPages: [
        { id: 'users', order: 20, label: 'Users', to: '/admin/settings/users' },
        { id: 'roles', order: 30, label: 'Roles', to: '/admin/settings/roles' },
      ],
    })
    definePlutoExtension({
      id: 'pluto',
      settingsPages: [
        {
          id: 'general',
          order: 0,
          label: 'pluto.settings.tabs.general',
          to: '/admin/settings',
        },
      ],
    })

    const { items } = usePlutoSettingsPages()

    expect(items.value.map((page) => page.label)).toEqual([
      'General',
      'Users',
      'Roles',
    ])
  })

  it('translates the labels again when the locale changes', async () => {
    const { definePlutoExtension, usePlutoSettingsPages } =
      await loadComposables()
    const locale = ref('en')
    vi.stubGlobal('usePlutoI18n', () => createI18nStub(locale))

    definePlutoExtension({
      id: 'pluto',
      settingsPages: [
        {
          id: 'general',
          label: 'pluto.settings.tabs.general',
          to: '/admin/settings',
        },
      ],
    })

    const { items } = usePlutoSettingsPages()

    expect(items.value[0]?.label).toBe('General')

    locale.value = 'pt-BR'

    expect(items.value[0]?.label).toBe('Geral')
  })

  it('hides a page whose enabled() returns false', async () => {
    const { definePlutoExtension, usePlutoSettingsPages } =
      await loadComposables()
    const on = ref(false)

    definePlutoExtension({
      id: 'test-layer',
      settingsPages: [
        {
          id: 'users',
          label: 'Users',
          to: '/admin/settings/users',
          enabled: () => on.value,
        },
      ],
    })

    const { items } = usePlutoSettingsPages()

    expect(items.value).toHaveLength(0)

    on.value = true

    expect(items.value).toHaveLength(1)
  })

  it('shows every page when no permissions driver is registered', async () => {
    const { definePlutoExtension, usePlutoSettingsPages } =
      await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      settingsPages: [
        {
          id: 'email',
          label: 'Email',
          to: '/admin/settings/email',
          capability: '*',
        },
      ],
    })

    expect(usePlutoSettingsPages().items.value).toHaveLength(1)
  })

  describe('with a permissions driver', () => {
    async function setup(granted: string[]) {
      const loaded = await loadComposables()

      loaded.definePlutoExtension({
        id: 'test-layer',
        permissionsDriver: { id: 'driver', load: async () => granted },
        settingsPages: [
          { id: 'general', order: 0, label: 'General', to: '/admin/settings' },
          {
            id: 'seo',
            order: 10,
            label: 'SEO',
            to: '/admin/settings/seo',
            capability: 'seo:manage',
          },
          {
            id: 'email',
            order: 20,
            label: 'Email',
            to: '/admin/settings/email',
            capability: '*',
          },
        ],
      })
      await loaded.usePlutoPermissions().load()

      return loaded.usePlutoSettingsPages()
    }

    it('filters by capability', async () => {
      const { items } = await setup(['seo:manage'])

      expect(items.value.map((page) => page.label)).toEqual(['General', 'SEO'])
    })

    it('treats the star capability as admin only', async () => {
      expect(
        (await setup(['seo:manage'])).items.value.map((page) => page.label)
      ).not.toContain('Email')
      expect(
        (await setup(['*'])).items.value.map((page) => page.label)
      ).toContain('Email')
    })

    it('reports allowed = false for a route the user may not open', async () => {
      const pages = await setup(['posts:read'])
      routePath.value = '/admin/settings/email'

      expect(pages.current.value?.label).toBe('Email')
      expect(pages.allowed.value).toBe(false)
    })

    it('reports allowed = true for an admin', async () => {
      const pages = await setup(['*'])
      routePath.value = '/admin/settings/email'

      expect(pages.allowed.value).toBe(true)
    })
  })

  describe('current', () => {
    async function setup() {
      const loaded = await loadComposables()

      loaded.definePlutoExtension({
        id: 'test-layer',
        settingsPages: [
          { id: 'general', label: 'General', to: '/admin/settings' },
          { id: 'users', label: 'Users', to: '/admin/settings/users' },
          {
            id: 'users-roles',
            label: 'Roles',
            to: '/admin/settings/users/roles',
          },
        ],
      })

      return loaded.usePlutoSettingsPages()
    }

    it('matches the exact path', async () => {
      const { current } = await setup()

      expect(current.value?.label).toBe('General')
    })

    it('picks the longest prefix', async () => {
      const { current } = await setup()

      routePath.value = '/admin/settings/users/roles/5'
      expect(current.value?.label).toBe('Roles')

      routePath.value = '/admin/settings/users/invite'
      expect(current.value?.label).toBe('Users')
    })

    it('ignores a trailing slash', async () => {
      const { current } = await setup()
      routePath.value = '/admin/settings/users/'

      expect(current.value?.label).toBe('Users')
    })

    it('does not match a path that only shares a name prefix', async () => {
      const { current } = await setup()
      routePath.value = '/admin/settings-old'

      expect(current.value).toBeUndefined()
    })

    it('is allowed when no page matches', async () => {
      const { allowed } = await setup()
      routePath.value = '/admin/other'

      expect(allowed.value).toBe(true)
    })
  })
})
