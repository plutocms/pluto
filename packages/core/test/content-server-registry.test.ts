import type {
  PlutoContentAdapter,
  PlutoContentType,
} from '../shared/types/content'
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

describe('extendContentTypes', () => {
  // An extension that adds one field to the types it names.
  function addField(id: string, field: string, only?: string, order?: number) {
    return {
      id,
      order,
      extend: (type: PlutoContentType): PlutoContentType =>
        only && type.name !== only
          ? type
          : {
              ...type,
              fields: [
                ...type.fields,
                { name: field, type: 'text', label: field },
              ],
            },
    }
  }

  const names = (type?: PlutoContentType) => type?.fields.map((f) => f.name)

  it('extends a type that registered before the extension', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    registerContentType(contentType('post'))
    extendContentTypes(addField('seo', 'seoTitle', 'post'))

    expect(names(getContentType('post'))).toEqual(['title', 'seoTitle'])
  })

  it('extends a type that registers after the extension', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    extendContentTypes(addField('seo', 'seoTitle', 'post'))
    registerContentType(contentType('post'))

    expect(names(getContentType('post'))).toEqual(['title', 'seoTitle'])
  })

  it('leaves another type as it is', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    const page = contentType('page')
    registerContentType(page)
    extendContentTypes(addField('seo', 'seoTitle', 'post'))

    expect(getContentType('page')).toBe(page)
  })

  it('replaces an extension with the same id', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    registerContentType(contentType('post'))
    extendContentTypes(addField('seo', 'first'))
    extendContentTypes(addField('seo', 'second'))

    expect(names(getContentType('post'))).toEqual(['title', 'second'])
  })

  it('runs the extensions by order, then by first registration', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    registerContentType(contentType('post'))
    extendContentTypes(addField('a', 'a'))
    extendContentTypes(addField('late', 'late', undefined, 200))
    extendContentTypes(addField('early', 'early', undefined, 10))
    extendContentTypes(addField('b', 'b'))

    expect(names(getContentType('post'))).toEqual([
      'title',
      'early',
      'a',
      'b',
      'late',
    ])
  })

  it('keeps the raw type unchanged', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    const post = contentType('post')
    registerContentType(post)
    extendContentTypes(addField('seo', 'seoTitle'))
    getContentType('post')

    expect(post.fields).toHaveLength(1)
  })

  it('gives the same extended type to getContentType and listContentTypes', async () => {
    const {
      registerContentType,
      extendContentTypes,
      getContentType,
      listContentTypes,
    } = await loadRegistry()

    registerContentType(contentType('post'))
    registerContentType(contentType('page'))
    extendContentTypes(addField('seo', 'seoTitle', 'post'))

    expect(listContentTypes().map((type) => type.name)).toEqual([
      'post',
      'page',
    ])
    expect(listContentTypes()[0]).toBe(getContentType('post'))
    expect(getContentType('post')).toBe(getContentType('post'))
  })

  it('drops the cache when a type registers again', async () => {
    const { registerContentType, extendContentTypes, getContentType } =
      await loadRegistry()

    registerContentType(contentType('post'))
    extendContentTypes(addField('seo', 'seoTitle'))
    getContentType('post')
    registerContentType({ ...contentType('post'), label: 'Post (updated)' })

    expect(getContentType('post')?.label).toBe('Post (updated)')
    expect(names(getContentType('post'))).toEqual(['title', 'seoTitle'])
  })
})
