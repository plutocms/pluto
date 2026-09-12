import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

// pluto-registry.ts, pluto-extension.ts, and pluto-permissions.ts all lean
// on Nuxt's auto-imported globals (`useNuxtApp`, `computed`, `ref`,
// `useState`, `usePlutoRegistry`). Outside a Nuxt build nothing injects
// them, so this file stubs them the same way `test/nuxt-config.test.ts`
// stubs `defineNuxtConfig` — see that file for the same pattern.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}
let stateStore: Map<string, ReturnType<typeof ref>>

beforeEach(() => {
  fakeNuxtApp = {}
  stateStore = new Map()

  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
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
