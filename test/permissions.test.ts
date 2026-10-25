import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18nStub } from './fixtures/i18n-stub'

// pluto-registry.ts, pluto-extension.ts, and pluto-permissions.ts all lean
// on Nuxt's auto-imported globals (`useNuxtApp`, `computed`, `ref`,
// `useState`, `usePlutoRegistry`). Outside a Nuxt build nothing injects
// them, so this file stubs them the same way `test/nuxt-config.test.ts`
// stubs `defineNuxtConfig` — see that file for the same pattern.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
  _plutoPermissionsLoad?: {
 userId: string
promise: Promise<void>
}
}
let stateStore: Map<string, ReturnType<typeof ref>>

beforeEach(() => {
  fakeNuxtApp = {}
  stateStore = new Map()

  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('usePlutoI18n', () => createI18nStub())
  vi.stubGlobal('ref', ref)
  // A minimal stand-in for Nuxt's useState: one ref per key, created once
  // and reused for the life of the test.
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

/**
 * Loads the real composables fresh for one test, and stubs
 * `usePlutoRegistry` as a global so the modules' own internal,
 * auto-import-style calls to it resolve to the same registry instance
 * this function returns.
 */
async function loadComposables() {
  const { usePlutoRegistry } = await import('../app/composables/pluto-registry')
  vi.stubGlobal('usePlutoRegistry', usePlutoRegistry)

  const { definePlutoExtension } = await import('../app/composables/pluto-extension')
  const { usePlutoCapabilities, usePlutoPermissions } = await import(
    '../app/composables/pluto-permissions'
  )

  return { usePlutoRegistry, definePlutoExtension, usePlutoCapabilities, usePlutoPermissions }
}

describe('usePlutoPermissions', () => {
  it('fails open (can() returns true) when no permissions driver is registered', async () => {
    const { usePlutoPermissions } = await loadComposables()

    const { hasDriver, can } = usePlutoPermissions()

    expect(hasDriver.value).toBe(false)
    expect(can('posts:publish')).toBe(true)
    expect(can('anything:at-all')).toBe(true)
  })

  it('grants every capability once the loaded list includes the "*" wildcard', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      permissionsDriver: { id: 'driver', load: async () => ['*'] },
    })

    const permissions = usePlutoPermissions()
    await permissions.load()

    expect(permissions.hasDriver.value).toBe(true)
    expect(permissions.isAdmin.value).toBe(true)
    expect(permissions.can('posts:publish')).toBe(true)
    expect(permissions.can('anything:at-all')).toBe(true)
  })

  it('grants only the exact capabilities a user holds', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      permissionsDriver: { id: 'driver', load: async () => ['posts:publish'] },
    })

    const permissions = usePlutoPermissions()
    await permissions.load()

    expect(permissions.isAdmin.value).toBe(false)
    expect(permissions.can('posts:publish')).toBe(true)
    expect(permissions.can('posts:delete')).toBe(false)
  })
})

describe('usePlutoCapabilities', () => {
  it('rewrites id to "<owner>:<id>" but never touches key', async () => {
    const { definePlutoExtension, usePlutoCapabilities } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      capabilities: [{ id: 'posts-publish', key: 'posts:publish', label: 'Publish posts' }],
    })

    const { items } = usePlutoCapabilities()

    expect(items.value).toHaveLength(1)
    expect(items.value[0]?.id).toBe('test-layer:posts-publish')
    expect(items.value[0]?.key).toBe('posts:publish')
  })
})

describe('usePlutoCapabilities groups', () => {
  it('groups by the owner prefix, in registry order', async () => {
    const { definePlutoExtension, usePlutoCapabilities } = await loadComposables()

    definePlutoExtension({
      id: 'blog',
      capabilities: [
        { id: 'publish', key: 'posts:publish', label: 'Publish' },
        { id: 'delete', key: 'posts:delete', label: 'Delete' },
      ],
    })
    definePlutoExtension({
      id: 'shop',
      capabilities: [{ id: 'stock', key: 'products:stock', label: 'Stock' }],
    })

    const { groups } = usePlutoCapabilities()

    expect(groups.value.map((group) => group.id)).toEqual(['blog', 'shop'])
    expect(groups.value[0]?.items.map((item) => item.key)).toEqual(['posts:publish', 'posts:delete'])
  })

  it('uses <owner>.capabilities.group when the key exists, else the owner id', async () => {
    const { definePlutoExtension, usePlutoCapabilities } = await loadComposables()
    vi.stubGlobal('usePlutoI18n', () => ({
      ...createI18nStub(),
      te: (key: string) => key === 'blog.capabilities.group',
      t: (key: string) => (key === 'blog.capabilities.group' ? 'Blog' : key),
    }))

    definePlutoExtension({ id: 'blog', capabilities: [{ id: 'a', key: 'posts:a', label: 'A' }] })
    definePlutoExtension({ id: 'shop', capabilities: [{ id: 'b', key: 'products:b', label: 'B' }] })

    const { groups } = usePlutoCapabilities()

    expect(groups.value.map((group) => group.label)).toEqual(['Blog', 'shop'])
  })

  it('adds an Other group for strings no layer declares', async () => {
    const { definePlutoExtension, usePlutoCapabilities } = await loadComposables()

    definePlutoExtension({ id: 'blog', capabilities: [{ id: 'a', key: 'posts:a', label: 'A' }] })

    const { groupsFor } = usePlutoCapabilities()
    const groups = groupsFor(['posts:a', 'legacy:thing', 'legacy:thing'])

    expect(groups.map((group) => group.id)).toEqual(['blog', 'other'])
    expect(groups[1]).toMatchObject({ label: 'Other' })
    expect(groups[1]?.items.map((item) => item.key)).toEqual(['legacy:thing'])
  })

  it('has no Other group when every string is declared', async () => {
    const { definePlutoExtension, usePlutoCapabilities } = await loadComposables()

    definePlutoExtension({ id: 'blog', capabilities: [{ id: 'a', key: 'posts:a', label: 'A' }] })

    expect(usePlutoCapabilities().groupsFor(['posts:a']).map((group) => group.id)).toEqual(['blog'])
  })
})

describe('usePlutoPermissions ensureLoaded', () => {
  function deferred() {
    let resolve!: (value: string[]) => void
    const promise = new Promise<string[]>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  it('shares one in-flight request between ensureLoaded and load', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()
    const pending = deferred()
    const driverLoad = vi.fn(() => pending.promise)
    definePlutoExtension({ id: 'test-layer', permissionsDriver: { id: 'driver', load: driverLoad } })

    const permissions = usePlutoPermissions()
    const first = permissions.ensureLoaded('user-1')
    const second = permissions.ensureLoaded('user-1')
    const third = permissions.load('user-1')
    expect(driverLoad).toHaveBeenCalledTimes(1)

    pending.resolve(['posts:read'])
    await Promise.all([first, second, third])

    expect(permissions.granted.value).toEqual(['posts:read'])
    expect(permissions.loaded.value).toBe(true)
  })

  it('returns at once when the list is loaded for the same user', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()
    const driverLoad = vi.fn(async () => ['posts:read'])
    definePlutoExtension({ id: 'test-layer', permissionsDriver: { id: 'driver', load: driverLoad } })

    const permissions = usePlutoPermissions()
    await permissions.ensureLoaded('user-1')
    await permissions.ensureLoaded('user-1')

    expect(driverLoad).toHaveBeenCalledTimes(1)
  })

  it('loads again when the user id changes, and drops the older result', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()
    const first = deferred()
    const second = deferred()
    const driverLoad = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    definePlutoExtension({ id: 'test-layer', permissionsDriver: { id: 'driver', load: driverLoad } })

    const permissions = usePlutoPermissions()
    const one = permissions.ensureLoaded('user-1')
    const two = permissions.ensureLoaded('user-2')
    expect(driverLoad).toHaveBeenCalledTimes(2)

    second.resolve(['*'])
    first.resolve([])
    await Promise.all([one, two])

    expect(permissions.granted.value).toEqual(['*'])

    await permissions.ensureLoaded('user-2')
    expect(driverLoad).toHaveBeenCalledTimes(2)
    driverLoad.mockResolvedValueOnce(['posts:read'])
    await permissions.ensureLoaded('user-3')
    expect(permissions.granted.value).toEqual(['posts:read'])
  })

  it('does nothing without a driver', async () => {
    const { usePlutoPermissions } = await loadComposables()
    const permissions = usePlutoPermissions()
    await permissions.ensureLoaded('user-1')
    expect(permissions.loaded.value).toBe(false)
  })

  it('rejects on a load error and allows a new request', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()
    const driverLoad = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(['posts:read'])
    definePlutoExtension({ id: 'test-layer', permissionsDriver: { id: 'driver', load: driverLoad } })

    const permissions = usePlutoPermissions()
    await expect(permissions.ensureLoaded('user-1')).rejects.toThrow('boom')
    expect(permissions.loaded.value).toBe(false)
    await permissions.ensureLoaded('user-1')
    expect(permissions.granted.value).toEqual(['posts:read'])
  })

  it('drops a result that arrives after clear()', async () => {
    const { definePlutoExtension, usePlutoPermissions } = await loadComposables()
    const pending = deferred()
    definePlutoExtension({ id: 'test-layer', permissionsDriver: { id: 'driver', load: () => pending.promise } })

    const permissions = usePlutoPermissions()
    const run = permissions.ensureLoaded('user-1')
    permissions.clear()
    pending.resolve(['*'])
    await run

    expect(permissions.loaded.value).toBe(false)
    expect(permissions.granted.value).toEqual([])
  })
})
