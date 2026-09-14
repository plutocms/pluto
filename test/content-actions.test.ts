import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

// pluto-content-actions.ts leans on Nuxt's auto-imported `usePlutoRegistry`
// and `computed`. Outside a Nuxt build nothing injects them — stub the same
// way test/permissions.test.ts and test/pluto-admin-nav-content.test.ts do.
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

  const { definePlutoExtension } = await import('../app/composables/pluto-extension')
  const { usePlutoContentActions } = await import('../app/composables/pluto-content-actions')

  return { definePlutoExtension, usePlutoContentActions }
}

describe('usePlutoContentActions', () => {
  it('matches an action whose contentType equals the requested type name', async () => {
    const { definePlutoExtension, usePlutoContentActions } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentActions: [
        { id: 'post-only', contentType: 'post', label: 'Post action', onSelect: () => {} },
        { id: 'product-only', contentType: 'product', label: 'Product action', onSelect: () => {} },
      ],
    })

    const postActions = usePlutoContentActions('post')

    expect(postActions.value.map((action) => action.label)).toEqual(['Post action'])
  })

  it('matches an action declared for every content type ("*")', async () => {
    const { definePlutoExtension, usePlutoContentActions } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentActions: [
        { id: 'everywhere', contentType: '*', label: 'Everywhere action', onSelect: () => {} },
      ],
    })

    expect(usePlutoContentActions('post').value.map((action) => action.label)).toEqual([
      'Everywhere action',
    ])
    expect(usePlutoContentActions('product').value.map((action) => action.label)).toEqual([
      'Everywhere action',
    ])
  })

  it('defaults placement to "toolbar" and filters by the requested placement', async () => {
    const { definePlutoExtension, usePlutoContentActions } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentActions: [
        { id: 'implicit-toolbar', contentType: 'post', label: 'Implicit toolbar', onSelect: () => {} },
        {
          id: 'explicit-toolbar',
          contentType: 'post',
          label: 'Explicit toolbar',
          placement: 'toolbar',
          onSelect: () => {},
        },
        {
          id: 'aside-only',
          contentType: 'post',
          label: 'Aside action',
          placement: 'aside',
          onSelect: () => {},
        },
      ],
    })

    const toolbarActions = usePlutoContentActions('post')
    const asideActions = usePlutoContentActions('post', 'aside')

    expect(toolbarActions.value.map((action) => action.label)).toEqual([
      'Implicit toolbar',
      'Explicit toolbar',
    ])
    expect(asideActions.value.map((action) => action.label)).toEqual(['Aside action'])
  })
})
