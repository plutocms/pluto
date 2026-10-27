import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineAsyncComponent } from 'vue'
import { findSyncComponents } from '../app/composables/internal/async-component'

// Same stubs as test/content-actions.test.ts: the composables lean on Nuxt auto-imports.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}

beforeEach(() => {
  fakeNuxtApp = {}
  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function load() {
  const { usePlutoRegistry } = await import('../app/composables/pluto-registry')
  vi.stubGlobal('usePlutoRegistry', usePlutoRegistry)
  const { definePlutoExtension } = await import('../app/composables/pluto-extension')
  const { usePlutoContentToolbarItems } = await import('../app/composables/pluto-content-toolbar-items')
  return { definePlutoExtension, usePlutoContentToolbarItems }
}

const component = { render: () => null }

describe('usePlutoContentToolbarItems', () => {
  it('matches the exact type name and the wildcard', async () => {
    const { definePlutoExtension, usePlutoContentToolbarItems } = await load()
    definePlutoExtension({
      id: 'layer',
      contentToolbarItems: [
        { id: 'all', contentType: '*', component },
        { id: 'post', contentType: 'post', component },
        { id: 'product', contentType: 'product', component },
      ],
    })

    expect(usePlutoContentToolbarItems('post').value.map((item) => item.id)).toEqual(['layer:all', 'layer:post'])
    expect(usePlutoContentToolbarItems('page').value.map((item) => item.id)).toEqual(['layer:all'])
  })

  it('sorts by order and drops a disabled item', async () => {
    const { definePlutoExtension, usePlutoContentToolbarItems } = await load()
    definePlutoExtension({
      id: 'layer',
      contentToolbarItems: [
        { id: 'late', contentType: '*', order: 200, component },
        { id: 'early', contentType: '*', order: 10, component },
        { id: 'off', contentType: '*', enabled: () => false, component },
      ],
    })

    expect(usePlutoContentToolbarItems('post').value.map((item) => item.id)).toEqual(['layer:early', 'layer:late'])
  })

  it('replaces the items of a layer when it registers again', async () => {
    const { definePlutoExtension, usePlutoContentToolbarItems } = await load()
    definePlutoExtension({ id: 'layer', contentToolbarItems: [{ id: 'a', contentType: '*', component }] })
    definePlutoExtension({ id: 'layer', contentToolbarItems: [{ id: 'b', contentType: '*', component }] })

    expect(usePlutoContentToolbarItems('post').value.map((item) => item.id)).toEqual(['layer:b'])
    definePlutoExtension({ id: 'layer' })
    expect(usePlutoContentToolbarItems('post').value).toEqual([])
  })
})

describe('findSyncComponents', () => {
  it('flags a toolbar item that is not async', () => {
    const asyncComponent = defineAsyncComponent(() => Promise.resolve(component))
    expect(findSyncComponents({
      id: 'layer',
      contentToolbarItems: [
        { id: 'sync', component },
        { id: 'lazy', component: asyncComponent },
      ],
    })).toEqual(['layer:contentToolbarItems:sync'])
  })
})
