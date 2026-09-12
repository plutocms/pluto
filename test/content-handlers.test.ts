import type { H3Event } from 'h3'
import type { PlutoContentContext, PlutoContentType } from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryContentAdapter } from './fixtures/memory-content-adapter'

// pluto-content.ts (the server registry) is a plain module-scope
// singleton — see its doc comment. Each test gets its own copy of it,
// through `vi.resetModules()` plus a fresh dynamic `import()`, the same
// isolation approach as test/content-server-registry.test.ts. Without
// this, an adapter registered in one test would still be registered in
// the next.
afterEach(() => {
  vi.resetModules()
})

async function loadHandlers() {
  const registry = await import('../server/utils/pluto-content')
  const handlers = await import('../server/utils/pluto-content-handlers')
  return { ...registry, ...handlers }
}

const fakeEvent = {} as H3Event

function contentType(overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    fields: [{ name: 'title', type: 'text', label: 'Title', required: true }],
    ...overrides,
  }
}

function ctxFor(type: PlutoContentType): PlutoContentContext {
  return { event: fakeEvent, type }
}

describe('requireContentAdapter', () => {
  it('throws a 500 when no adapter is registered', async () => {
    const { requireContentAdapter } = await loadHandlers()

    expect(() => requireContentAdapter()).toThrow(
      expect.objectContaining({ statusCode: 500 })
    )
  })
})

describe('requireContentType', () => {
  it('throws a 404 for an unregistered type name', async () => {
    const { requireContentType } = await loadHandlers()

    expect(() => requireContentType('missing')).toThrow(
      expect.objectContaining({ statusCode: 404 })
    )
  })

  it('returns the registered type', async () => {
    const { registerContentType, requireContentType } = await loadHandlers()

    registerContentType(contentType())

    expect(requireContentType('post').name).toBe('post')
  })
})

describe('listContentItems', () => {
  it('returns items from the adapter', async () => {
    const { registerContentAdapter, listContentItems } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const type = contentType()
    const ctx = ctxFor(type)
    await adapter.create(ctx, { title: 'Hello' })

    const result = await listContentItems(ctx, {})

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.title).toBe('Hello')
  })

  it('never calls adapter.authorize, even when the adapter would throw', async () => {
    const { registerContentAdapter, listContentItems } = await loadHandlers()

    const authorize = vi.fn(async () => {
      throw new Error('authorize should not be called for list')
    })
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const type = contentType({ capabilities: { read: 'posts:read' } })
    const ctx = ctxFor(type)

    await expect(listContentItems(ctx, {})).resolves.toEqual({ data: [], total: 0 })
    expect(authorize).not.toHaveBeenCalled()
  })

  it('always requests includeUnpublished from the adapter', async () => {
    const { registerContentAdapter, listContentItems } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const listSpy = vi.spyOn(adapter, 'list')
    registerContentAdapter(adapter)

    const type = contentType()
    const ctx = ctxFor(type)

    await listContentItems(ctx, {})

    expect(listSpy).toHaveBeenCalledWith(ctx, expect.objectContaining({ includeUnpublished: true }))
  })
})

describe('getContentItem', () => {
  it('returns the item when the adapter finds one', async () => {
    const { registerContentAdapter, getContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const type = contentType()
    const ctx = ctxFor(type)
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(getContentItem(ctx, created.id)).resolves.toEqual(created)
  })

  it('throws a 404 when the adapter returns null', async () => {
    const { registerContentAdapter, getContentItem } = await loadHandlers()

    registerContentAdapter(createMemoryContentAdapter())

    const ctx = ctxFor(contentType())

    await expect(getContentItem(ctx, 999)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    )
  })

  it('never calls adapter.authorize', async () => {
    const { registerContentAdapter, getContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {
      throw new Error('authorize should not be called for get')
    })
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const type = contentType({ capabilities: { read: 'posts:read' } })
    const ctx = ctxFor(type)
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(getContentItem(ctx, created.id)).resolves.toEqual(created)
    expect(authorize).not.toHaveBeenCalled()
  })
})

describe('createContentItem', () => {
  it('succeeds with a valid payload and calls adapter.create once', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const createSpy = vi.spyOn(adapter, 'create')
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    const item = await createContentItem(ctx, { title: 'Hello' })

    expect(item.title).toBe('Hello')
    expect(createSpy).toHaveBeenCalledTimes(1)
  })

  it('throws a 400 for an invalid payload and never calls adapter.create', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const createSpy = vi.spyOn(adapter, 'create')
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())

    await expect(createContentItem(ctx, { title: '' })).rejects.toThrow(
      expect.objectContaining({ statusCode: 400 })
    )
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('throws a 400 when the body is not a plain object', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    registerContentAdapter(createMemoryContentAdapter())
    const ctx = ctxFor(contentType())

    await expect(createContentItem(ctx, 'not-an-object')).rejects.toThrow(
      expect.objectContaining({ statusCode: 400 })
    )
  })

  it('calls adapter.authorize with the declared write capability', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {})
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType({ capabilities: { write: 'posts:write' } }))
    await createContentItem(ctx, { title: 'Hello' })

    expect(authorize).toHaveBeenCalledWith(fakeEvent, 'posts:write')
  })

  it('rejects when adapter.authorize throws', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {
      throw new Error('forbidden')
    })
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType({ capabilities: { write: 'posts:write' } }))

    await expect(createContentItem(ctx, { title: 'Hello' })).rejects.toThrow('forbidden')
  })

  it('fails open when the type declares a write capability but the adapter has no authorize method', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    // createMemoryContentAdapter() with no options registers no
    // `authorize` method at all — this is the fail-open path, not the
    // "declared no capability" path below.
    registerContentAdapter(createMemoryContentAdapter())

    const ctx = ctxFor(contentType({ capabilities: { write: 'posts:write' } }))

    await expect(createContentItem(ctx, { title: 'Hello' })).resolves.toMatchObject({
      title: 'Hello',
    })
  })

  it('never calls adapter.authorize when the type declares no write capability', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {})
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    // No `capabilities` at all on this type.
    const ctx = ctxFor(contentType())
    await createContentItem(ctx, { title: 'Hello' })

    expect(authorize).not.toHaveBeenCalled()
  })

  it('calls a registered afterCreate hook exactly once, with the created item and raw body', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    registerContentAdapter(createMemoryContentAdapter())

    const afterCreate = vi.fn(async () => {})
    const ctx = ctxFor(contentType({ hooks: { afterCreate } }))

    const item = await createContentItem(ctx, { title: 'Hello' })

    expect(afterCreate).toHaveBeenCalledTimes(1)
    expect(afterCreate).toHaveBeenCalledWith(ctx, item, { title: 'Hello' })
  })

  it('rejects the whole operation when afterCreate throws', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    registerContentAdapter(createMemoryContentAdapter())

    const afterCreate = vi.fn(async () => {
      throw new Error('hook failed')
    })
    const ctx = ctxFor(contentType({ hooks: { afterCreate } }))

    await expect(createContentItem(ctx, { title: 'Hello' })).rejects.toThrow('hook failed')
  })
})

describe('updateContentItem', () => {
  it('succeeds with a valid partial payload and calls adapter.update once', async () => {
    const { registerContentAdapter, updateContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const updateSpy = vi.spyOn(adapter, 'update')
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    const created = await adapter.create(ctx, { title: 'Hello' })

    const item = await updateContentItem(ctx, created.id, { title: 'Updated' })

    expect(item.title).toBe('Updated')
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('allows a required field to be omitted (partial validation)', async () => {
    const { registerContentAdapter, updateContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(updateContentItem(ctx, created.id, {})).resolves.toBeDefined()
  })

  it('still fails when a required field is present but empty', async () => {
    const { registerContentAdapter, updateContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(updateContentItem(ctx, created.id, { title: '' })).rejects.toThrow(
      expect.objectContaining({ statusCode: 400 })
    )
  })

  it('calls adapter.authorize with the declared write capability', async () => {
    const { registerContentAdapter, updateContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {})
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType({ capabilities: { write: 'posts:write' } }))
    const created = await adapter.create(ctx, { title: 'Hello' })

    await updateContentItem(ctx, created.id, { title: 'Updated' })

    expect(authorize).toHaveBeenCalledWith(fakeEvent, 'posts:write')
  })

  it('calls a registered afterUpdate hook exactly once, with the updated item and raw body', async () => {
    const { registerContentAdapter, updateContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const afterUpdate = vi.fn(async () => {})
    const type = contentType({ hooks: { afterUpdate } })
    const ctx = ctxFor(type)
    const created = await adapter.create(ctx, { title: 'Hello' })

    const item = await updateContentItem(ctx, created.id, { title: 'Updated' })

    expect(afterUpdate).toHaveBeenCalledTimes(1)
    expect(afterUpdate).toHaveBeenCalledWith(ctx, item, { title: 'Updated' })
  })

  it('rejects the whole operation when afterUpdate throws', async () => {
    const { registerContentAdapter, updateContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const afterUpdate = vi.fn(async () => {
      throw new Error('hook failed')
    })
    const type = contentType({ hooks: { afterUpdate } })
    const ctx = ctxFor(type)
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(updateContentItem(ctx, created.id, { title: 'Updated' })).rejects.toThrow('hook failed')
  })
})

describe('deleteContentItem', () => {
  it('calls adapter.remove', async () => {
    const { registerContentAdapter, deleteContentItem, getContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    const created = await adapter.create(ctx, { title: 'Hello' })

    await deleteContentItem(ctx, created.id)

    await expect(getContentItem(ctx, created.id)).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    )
  })

  it('calls adapter.authorize with the declared delete capability', async () => {
    const { registerContentAdapter, deleteContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {})
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType({ capabilities: { delete: 'posts:delete' } }))
    const created = await adapter.create(ctx, { title: 'Hello' })

    await deleteContentItem(ctx, created.id)

    expect(authorize).toHaveBeenCalledWith(fakeEvent, 'posts:delete')
  })

  it('rejects when adapter.authorize throws', async () => {
    const { registerContentAdapter, deleteContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {
      throw new Error('forbidden')
    })
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType({ capabilities: { delete: 'posts:delete' } }))
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(deleteContentItem(ctx, created.id)).rejects.toThrow('forbidden')
  })

  it('fails open when the type declares a delete capability but the adapter has no authorize method', async () => {
    const { registerContentAdapter, deleteContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType({ capabilities: { delete: 'posts:delete' } }))
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(deleteContentItem(ctx, created.id)).resolves.toBeUndefined()
  })

  it('never calls adapter.authorize when the type declares no delete capability', async () => {
    const { registerContentAdapter, deleteContentItem } = await loadHandlers()

    const authorize = vi.fn(async () => {})
    const adapter = createMemoryContentAdapter({ authorize })
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    const created = await adapter.create(ctx, { title: 'Hello' })

    await deleteContentItem(ctx, created.id)

    expect(authorize).not.toHaveBeenCalled()
  })
})
