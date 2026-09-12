import type { PlutoContentAdapter, PlutoContentType } from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'

// pluto-content.ts (server/utils) is a plain module-scope singleton by
// design — see its doc comment. That means state persists across imports
// within one test file unless we reset it. `vi.resetModules()` plus a
// fresh dynamic `import()` per test gives each test its own copy of the
// module's `Map` and adapter variable, the same isolation
// `test/content-registry.test.ts` gets from stubbing `useNuxtApp` for the
// client registry — the mechanism differs (this module has no Nuxt-global
// dependency to stub) but the goal is the same: no state leaks between
// tests.
afterEach(() => {
  vi.resetModules()
})

async function loadRegistry() {
  return import('../server/utils/pluto-content')
}

function contentType(name: string): PlutoContentType {
  return {
    name,
    label: name,
    labelPlural: name,
    source: name,
    titleField: 'title',
    fields: [{ name: 'title', type: 'text', label: 'Title' }],
  }
}

function adapter(id: string): PlutoContentAdapter {
  return {
    id,
    list: async () => ({ data: [] }),
    get: async () => null,
    create: async (_ctx, values) => ({ id: 1, ...values }),
    update: async (_ctx, id2, values) => ({ id: id2, ...values }),
    remove: async () => {},
  }
}

describe('registerContentType / getContentType', () => {
  it('returns undefined for a name that was never registered', async () => {
    const { getContentType } = await loadRegistry()

    expect(getContentType('missing')).toBeUndefined()
  })

  it('returns the registered type by its name', async () => {
    const { registerContentType, getContentType } = await loadRegistry()

    registerContentType(contentType('post'))

    expect(getContentType('post')?.name).toBe('post')
  })

  it('overwrites a previously registered type with the same name', async () => {
    const { registerContentType, getContentType } = await loadRegistry()

    registerContentType(contentType('post'))
    registerContentType({ ...contentType('post'), label: 'Post (updated)' })

    expect(getContentType('post')?.label).toBe('Post (updated)')
  })

  it('keeps two differently named types independent', async () => {
    const { registerContentType, getContentType } = await loadRegistry()

    registerContentType(contentType('post'))
    registerContentType(contentType('page'))

    expect(getContentType('post')?.name).toBe('post')
    expect(getContentType('page')?.name).toBe('page')
  })
})

describe('registerContentAdapter / getContentAdapter', () => {
  it('returns undefined when no adapter is registered', async () => {
    const { getContentAdapter } = await loadRegistry()

    expect(getContentAdapter()).toBeUndefined()
  })

  it('returns the registered adapter', async () => {
    const { registerContentAdapter, getContentAdapter } = await loadRegistry()

    registerContentAdapter(adapter('first'))

    expect(getContentAdapter()?.id).toBe('first')
  })

  it('replaces a previously registered adapter — last registered wins', async () => {
    const { registerContentAdapter, getContentAdapter } = await loadRegistry()

    registerContentAdapter(adapter('first'))
    registerContentAdapter(adapter('second'))

    expect(getContentAdapter()?.id).toBe('second')
  })
})
