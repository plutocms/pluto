import type { Component } from 'vue'
import type { PlutoContentType } from '../shared/types/content'
import type { PlutoMediaAdapter } from '../shared/types/media'
import type { PlutoRegistry } from '../shared/types/registry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

// Same Nuxt-global stubbing as test/permissions.test.ts — see that file for
// why: pluto-registry.ts and pluto-extension.ts lean on Nuxt's
// auto-imported globals, which nothing provides outside a Nuxt build.
let fakeNuxtApp: {
  _plutoRegistry?: PlutoRegistry
}

beforeEach(() => {
  fakeNuxtApp = {}

  vi.stubGlobal('useNuxtApp', () => fakeNuxtApp)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadComposables() {
  const { usePlutoRegistry } = await import('../app/composables/pluto-registry')
  vi.stubGlobal('usePlutoRegistry', usePlutoRegistry)

  const { definePlutoExtension } = await import('../app/composables/pluto-extension')
  const { usePlutoContentTypes } = await import('../app/composables/pluto-content-types')

  return { usePlutoRegistry, definePlutoExtension, usePlutoContentTypes }
}

function contentType(name: string, overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name,
    label: name,
    labelPlural: name,
    source: name,
    titleField: 'title',
    fields: [{ name: 'title', type: 'text', label: 'Title' }],
    ...overrides,
  }
}

const FakeComponent = {} as Component

const fakeAdapter: PlutoMediaAdapter = {
  id: 'fake',
  list: async () => ({ data: [] }),
  upload: async () => ({ id: '1', name: 'file', url: '/file' }),
  remove: async () => {},
  getUrl: () => '/file',
}

describe('contentTypes bucket', () => {
  it('merges two owners and sorts by order', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentTypes: [{ id: 'b', order: 50, type: contentType('post') }],
    })
    definePlutoExtension({
      id: 'owner-b',
      contentTypes: [{ id: 'a', order: 10, type: contentType('page') }],
    })

    expect(registry.contentTypes.list.value.map((entry) => entry.id)).toEqual([
      'owner-b:a',
      'owner-a:b',
    ])
  })

  it('keeps first-registration order for equal-order entries', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentTypes: [{ id: 'first', type: contentType('post') }],
    })
    definePlutoExtension({
      id: 'owner-b',
      contentTypes: [{ id: 'second', type: contentType('page') }],
    })

    expect(registry.contentTypes.list.value.map((entry) => entry.id)).toEqual([
      'owner-a:first',
      'owner-b:second',
    ])
  })

  it('replaces an owner contribution instead of appending to it', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentTypes: [{ id: 'one', type: contentType('post') }],
    })
    definePlutoExtension({
      id: 'owner-a',
      contentTypes: [{ id: 'one', type: contentType('post', { label: 'Post (updated)' }) }],
    })

    expect(registry.contentTypes.list.value).toHaveLength(1)
    expect(registry.contentTypes.list.value[0]?.type.label).toBe('Post (updated)')
  })

  it('drops an owner entire contribution when re-registered with an empty list', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentTypes: [{ id: 'one', type: contentType('post') }],
    })
    definePlutoExtension({ id: 'owner-b', contentTypes: [{ id: 'two', type: contentType('page') }] })
    definePlutoExtension({ id: 'owner-a', contentTypes: [] })

    expect(registry.contentTypes.list.value.map((entry) => entry.id)).toEqual(['owner-b:two'])
  })

  it('rewrites entry id to "<owner>:<id>" but never touches type.name', async () => {
    const { definePlutoExtension, usePlutoContentTypes } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [{ id: 'posts', type: contentType('post') }],
    })

    const { items } = usePlutoContentTypes()

    expect(items.value).toHaveLength(1)
    expect(items.value[0]?.id).toBe('test-layer:posts')
    expect(items.value[0]?.type.name).toBe('post')
  })

  it('byName looks up by type.name, not the registry entry id', async () => {
    const { definePlutoExtension, usePlutoContentTypes } = await loadComposables()

    definePlutoExtension({
      id: 'test-layer',
      contentTypes: [{ id: 'some-registry-id', type: contentType('post') }],
    })

    const { byName } = usePlutoContentTypes()

    expect(byName('post')?.name).toBe('post')
    expect(byName('test-layer:some-registry-id')).toBeUndefined()
    expect(byName('some-registry-id')).toBeUndefined()
  })
})

describe('contentFieldWidgets bucket', () => {
  it('merges two owners and sorts by order', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentFieldWidgets: [{ id: 'b', order: 50, fieldType: 'text', component: FakeComponent }],
    })
    definePlutoExtension({
      id: 'owner-b',
      contentFieldWidgets: [{ id: 'a', order: 10, fieldType: 'number', component: FakeComponent }],
    })

    expect(registry.contentFieldWidgets.list.value.map((entry) => entry.id)).toEqual([
      'owner-b:a',
      'owner-a:b',
    ])
  })

  it('replaces an owner contribution instead of appending to it', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentFieldWidgets: [{ id: 'one', fieldType: 'text', component: FakeComponent }],
    })
    definePlutoExtension({
      id: 'owner-a',
      contentFieldWidgets: [{ id: 'one', fieldType: 'richtext', component: FakeComponent }],
    })

    expect(registry.contentFieldWidgets.list.value).toHaveLength(1)
    expect(registry.contentFieldWidgets.list.value[0]?.fieldType).toBe('richtext')
  })

  it('drops an owner entire contribution on remove', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      contentFieldWidgets: [{ id: 'one', fieldType: 'text', component: FakeComponent }],
    })
    definePlutoExtension({
      id: 'owner-b',
      contentFieldWidgets: [{ id: 'two', fieldType: 'number', component: FakeComponent }],
    })
    registry.contentFieldWidgets.remove('owner-a')

    expect(registry.contentFieldWidgets.list.value.map((entry) => entry.id)).toEqual([
      'owner-b:two',
    ])
  })
})

describe('mediaAdapters bucket', () => {
  it('merges two owners and sorts by order', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({
      id: 'owner-a',
      mediaAdapters: [{ id: 'b', order: 50, adapter: fakeAdapter }],
    })
    definePlutoExtension({
      id: 'owner-b',
      mediaAdapters: [{ id: 'a', order: 10, adapter: fakeAdapter }],
    })

    expect(registry.mediaAdapters.list.value.map((entry) => entry.id)).toEqual([
      'owner-b:a',
      'owner-a:b',
    ])
  })

  it('replaces an owner contribution instead of appending to it', async () => {
    const { usePlutoRegistry, definePlutoExtension } = await loadComposables()
    const registry = usePlutoRegistry()

    definePlutoExtension({ id: 'owner-a', mediaAdapters: [{ id: 'one', adapter: fakeAdapter }] })
    definePlutoExtension({
      id: 'owner-a',
      mediaAdapters: [{ id: 'one', adapter: { ...fakeAdapter, id: 'fake-updated' } }],
    })

    expect(registry.mediaAdapters.list.value).toHaveLength(1)
    expect(registry.mediaAdapters.list.value[0]?.adapter.id).toBe('fake-updated')
  })
})
