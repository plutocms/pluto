import type { H3Event } from 'h3'
import type { PlutoContentType } from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import {
  contentTypeAdminBar,
  contentTypeEditPath,
  contentTypeNewPath,
} from '../shared/utils/content-admin-paths'
import {
  isSingletonType,
  singletonItemId,
} from '../shared/utils/content-singleton'
import { createMemoryContentAdapter } from './fixtures/memory-content-adapter'

afterEach(() => {
  vi.resetModules()
})

const event = {} as H3Event

function contact(
  overrides: Partial<PlutoContentType> = {}
): PlutoContentType {
  return {
    name: 'contact',
    label: 'Contact info',
    labelPlural: 'Contact info',
    source: 'settings',
    titleField: 'email',
    singleton: true,
    fields: [
      { name: 'email', type: 'text', label: 'Email', required: true },
      { name: 'phone', type: 'text', label: 'Phone' },
    ],
    ...overrides,
  }
}

describe('singleton helpers', () => {
  it('tells a singleton type and gives its item id', () => {
    expect(isSingletonType(contact())).toBe(true)
    expect(isSingletonType(contact({ singleton: false }))).toBe(false)
    expect(isSingletonType(undefined)).toBe(false)
    expect(singletonItemId(contact())).toBe('contact')
    expect(singletonItemId(contact({ singleton: { id: 'main' } }))).toBe(
      'main'
    )
    expect(singletonItemId(contact({ singleton: {} }))).toBe('contact')
  })

  it('gives every admin path of a singleton as the base path', () => {
    const type = contact({ newPath: '/x/new', editPath: (id) => `/x/${id}` })

    expect(contentTypeNewPath(type)).toBe('/admin/content/contact')
    expect(contentTypeEditPath(type, 'contact')).toBe('/admin/content/contact')
    expect(contentTypeEditPath(contact({ basePath: '/admin/contact' }), 1)).toBe(
      '/admin/contact'
    )
  })

  it('gives a singleton no New button in the admin bar', () => {
    expect(contentTypeAdminBar(contact({ adminBar: true }))).toEqual({
      new: false,
      edit: true,
    })
    expect(
      contentTypeAdminBar(contact({ adminBar: { new: true, edit: true } }))
    ).toEqual({ new: false, edit: true })
  })
})

describe('singleton handlers', () => {
  async function load() {
    const registry = await import('../server/utils/pluto-content')
    const handlers = await import('../server/utils/pluto-content-handlers')
    registry.registerContentAdapter(createMemoryContentAdapter())
    return handlers
  }

  it('creates the item once, then refuses a second one', async () => {
    const { createContentItem } = await load()
    const ctx = { event, type: contact() }

    const item = await createContentItem(ctx, { email: 'a@b.c' })
    expect(item.email).toBe('a@b.c')

    await expect(createContentItem(ctx, { email: 'x@y.z' })).rejects.toEqual(
      expect.objectContaining({
        statusCode: 409,
        data: expect.objectContaining({
          i18n: expect.objectContaining({ key: 'pluto.errors.singletonExists' }),
        }),
      })
    )
  })

  it('refuses to delete the item', async () => {
    const { createContentItem, deleteContentItem } = await load()
    const ctx = { event, type: contact() }
    const item = await createContentItem(ctx, { email: 'a@b.c' })

    await expect(deleteContentItem(ctx, item.id)).rejects.toEqual(
      expect.objectContaining({ statusCode: 400 })
    )
  })
})

describe('singleton in the Git CMS', () => {
  function adapterFor(files: Record<string, string> = {}) {
    const store = createMemoryStore(files)
    const adapter = createMarkdownContentAdapter({
      store,
      dir: 'content',
      getAccess: async () => ({ capabilities: ['*'], auth: { token: 't' } }),
    })
    return { store, adapter }
  }

  it('writes the item to <source>/<id>.md, whatever the title', async () => {
    const { store, adapter } = adapterFor()
    const type = contact()

    const item = await adapter.create({ event, type }, { email: 'a@b.c' })

    expect(item.id).toBe('contact')
    const file = await store.readFile('content/settings/contact.md', 'head')
    expect(file?.text).toContain('email: a@b.c')
  })

  it('sees only its own file in a shared folder', async () => {
    const { adapter } = adapterFor({
      'content/settings/contact.md': '---\nemail: a@b.c\n---\n',
      'content/settings/social.md': '---\nemail: other@b.c\n---\n',
    })
    const type = contact()

    const list = await adapter.list({ event, type }, { includeUnpublished: true })
    expect(list.data.map((item) => item.id)).toEqual(['contact'])
    expect(await adapter.get({ event, type }, 'social')).toBeNull()
    expect((await adapter.get({ event, type }, 'contact'))?.email).toBe(
      'a@b.c'
    )
  })

  it('uses singleton.id for the file name', async () => {
    const { store, adapter } = adapterFor()
    const type = contact({ singleton: { id: 'main' } })

    const item = await adapter.create({ event, type }, { email: 'a@b.c' })

    expect(item.id).toBe('main')
    expect(await store.readFile('content/settings/main.md', 'head')).not.toBe(
      null
    )
  })
})
