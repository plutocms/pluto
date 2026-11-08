import type { H3Event } from 'h3'
import type {
  PlutoContentContext,
  PlutoContentType,
} from '../shared/types/content'
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

function contentType(
  overrides: Partial<PlutoContentType> = {}
): PlutoContentType {
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

    await expect(listContentItems(ctx, {})).resolves.toEqual({
      data: [],
      total: 0,
    })
    expect(authorize).not.toHaveBeenCalled()
  })

  it('narrows to published rows when published is true', async () => {
    const { registerContentAdapter, listContentItems } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const listSpy = vi.spyOn(adapter, 'list')
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())

    await listContentItems(ctx, { limit: 1, published: true })

    expect(listSpy).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ limit: 1, includeUnpublished: false })
    )
  })

  it('passes the search, the status, the filters and the sort of the admin list', async () => {
    const { registerContentAdapter, listContentItems } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const listSpy = vi.spyOn(adapter, 'list')
    registerContentAdapter(adapter)

    const ctx = ctxFor(
      contentType({ defaultSort: { field: 'title', direction: 'asc' } })
    )

    await listContentItems(ctx, {
      search: 'hi',
      status: 'draft',
      filters: { kind: 'news' },
      sort: { field: 'views', direction: 'desc' },
    })
    await listContentItems(ctx, {})

    expect(listSpy).toHaveBeenNthCalledWith(
      1,
      ctx,
      expect.objectContaining({
        search: 'hi',
        status: 'draft',
        filters: { kind: 'news' },
        sort: { field: 'views', direction: 'desc' },
        includeUnpublished: true,
      })
    )
    // With no sort, the default sort of the type.
    expect(listSpy).toHaveBeenNthCalledWith(
      2,
      ctx,
      expect.objectContaining({ sort: { field: 'title', direction: 'asc' } })
    )
  })

  it('requests includeUnpublished from the adapter by default', async () => {
    const { registerContentAdapter, listContentItems } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    const listSpy = vi.spyOn(adapter, 'list')
    registerContentAdapter(adapter)

    const type = contentType()
    const ctx = ctxFor(type)

    await listContentItems(ctx, {})

    expect(listSpy).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ includeUnpublished: true })
    )
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

    await expect(createContentItem(ctx, { title: 'Hello' })).rejects.toThrow(
      'forbidden'
    )
  })

  it('fails open when the type declares a write capability but the adapter has no authorize method', async () => {
    const { registerContentAdapter, createContentItem } = await loadHandlers()

    // createMemoryContentAdapter() with no options registers no
    // `authorize` method at all — this is the fail-open path, not the
    // "declared no capability" path below.
    registerContentAdapter(createMemoryContentAdapter())

    const ctx = ctxFor(contentType({ capabilities: { write: 'posts:write' } }))

    await expect(
      createContentItem(ctx, { title: 'Hello' })
    ).resolves.toMatchObject({
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

    await expect(createContentItem(ctx, { title: 'Hello' })).rejects.toThrow(
      'hook failed'
    )
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

    await expect(
      updateContentItem(ctx, created.id, { title: '' })
    ).rejects.toThrow(expect.objectContaining({ statusCode: 400 }))
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

    await expect(
      updateContentItem(ctx, created.id, { title: 'Updated' })
    ).rejects.toThrow('hook failed')
  })
})

describe('deleteContentItem', () => {
  it('calls adapter.remove', async () => {
    const { registerContentAdapter, deleteContentItem, getContentItem } =
      await loadHandlers()

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

    const ctx = ctxFor(
      contentType({ capabilities: { delete: 'posts:delete' } })
    )
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

    const ctx = ctxFor(
      contentType({ capabilities: { delete: 'posts:delete' } })
    )
    const created = await adapter.create(ctx, { title: 'Hello' })

    await expect(deleteContentItem(ctx, created.id)).rejects.toThrow(
      'forbidden'
    )
  })

  it('fails open when the type declares a delete capability but the adapter has no authorize method', async () => {
    const { registerContentAdapter, deleteContentItem } = await loadHandlers()

    const adapter = createMemoryContentAdapter()
    registerContentAdapter(adapter)

    const ctx = ctxFor(
      contentType({ capabilities: { delete: 'posts:delete' } })
    )
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

describe('contentActivity', () => {
  // Thursday 2026-10-15, 10:00 UTC. Its week starts on Monday 2026-10-12.
  const now = new Date('2026-10-15T10:00:00Z')

  it('reports unsupported when the adapter has no countCreated', async () => {
    const { registerContentAdapter, contentActivity } = await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter())

    const result = await contentActivity(ctxFor(contentType()), {
      weeks: 4,
      now,
    })

    expect(result).toEqual({ supported: false, interval: 'week', points: [] })
  })

  it('counts one Monday-to-Monday UTC range per week, oldest first', async () => {
    const { registerContentAdapter, contentActivity } = await loadHandlers()
    const ranges: {
      from: string
      to: string
    }[] = []
    registerContentAdapter({
      ...createMemoryContentAdapter(),
      countCreated: async (_ctx, range) => {
        ranges.push(range)
        return ranges.length
      },
    })

    const result = await contentActivity(ctxFor(contentType()), {
      weeks: 3,
      now,
    })

    expect(result.supported).toBe(true)
    expect(result.points.map((point) => point.start)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ])
    expect(ranges[2]).toEqual({
      from: '2026-10-12T00:00:00.000Z',
      to: '2026-10-19T00:00:00.000Z',
    })
    expect(result.points.map((point) => point.count)).toEqual([1, 2, 3])
  })

  it('clamps weeks between 1 and the maximum', async () => {
    const {
      registerContentAdapter,
      contentActivity,
      CONTENT_ACTIVITY_MAX_WEEKS,
    } = await loadHandlers()
    registerContentAdapter({
      ...createMemoryContentAdapter(),
      countCreated: async () => 0,
    })

    expect(
      (await contentActivity(ctxFor(contentType()), { weeks: 0, now })).points
    ).toHaveLength(1)
    expect(
      (await contentActivity(ctxFor(contentType()), { weeks: 999, now })).points
    ).toHaveLength(CONTENT_ACTIVITY_MAX_WEEKS)
  })

  it('reports unsupported when the adapter returns null for the type', async () => {
    const { registerContentAdapter, contentActivity } = await loadHandlers()
    registerContentAdapter({
      ...createMemoryContentAdapter(),
      countCreated: async () => null,
    })

    const result = await contentActivity(ctxFor(contentType()), {
      weeks: 4,
      now,
    })

    expect(result).toEqual({ supported: false, interval: 'week', points: [] })
  })
})

describe('content revisions', () => {
  const revision = {
    id: 'abc123',
    createdAt: '2026-11-01T10:00:00Z',
    action: 'update' as const,
  }

  function withRevisions(authorize?: (...args: unknown[]) => Promise<void>) {
    const listRevisions = vi.fn(async () => ({
      data: [revision],
      nextCursor: 'next',
    }))
    const getRevision = vi.fn(
      async (_ctx: unknown, id: string | number, revisionId: string) =>
        revisionId === 'abc123' ? { id, title: 'Old', _version: 'b1' } : null
    )
    return {
      adapter: {
        ...createMemoryContentAdapter(authorize ? { authorize } : {}),
        listRevisions,
        getRevision,
      },
      listRevisions,
      getRevision,
    }
  }

  it('answers supported: false when the adapter keeps no revisions', async () => {
    const { registerContentAdapter, listContentRevisions, getContentRevision } =
      await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter())

    const ctx = ctxFor(contentType())
    expect(await listContentRevisions(ctx, 'hello')).toEqual({
      supported: false,
      data: [],
    })
    await expect(getContentRevision(ctx, 'hello', 'abc123')).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    )
  })

  it('lists a page, with the limit clamped and the cursor passed on', async () => {
    const { registerContentAdapter, listContentRevisions } =
      await loadHandlers()
    const { adapter, listRevisions } = withRevisions()
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    expect(
      await listContentRevisions(ctx, 'a/b', { limit: 999, cursor: 'c1' })
    ).toEqual({ supported: true, data: [revision], nextCursor: 'next' })
    expect(listRevisions).toHaveBeenCalledWith(ctx, 'a/b', {
      limit: 50,
      cursor: 'c1',
    })

    await listContentRevisions(ctx, 'a/b', { limit: 0 })
    expect(listRevisions).toHaveBeenLastCalledWith(ctx, 'a/b', { limit: 20 })
  })

  it('gets one revision, and 404 for an unknown one', async () => {
    const { registerContentAdapter, getContentRevision } = await loadHandlers()
    const { adapter } = withRevisions()
    registerContentAdapter(adapter)

    const ctx = ctxFor(contentType())
    expect(await getContentRevision(ctx, 'hello', 'abc123')).toMatchObject({
      title: 'Old',
    })
    await expect(getContentRevision(ctx, 'hello', 'zzz')).rejects.toThrow(
      expect.objectContaining({ statusCode: 404 })
    )
  })

  it('needs the write capability of the type', async () => {
    const { registerContentAdapter, listContentRevisions, getContentRevision } =
      await loadHandlers()
    const authorize = vi.fn(async () => {
      throw new Error('forbidden')
    })
    const { adapter, listRevisions, getRevision } = withRevisions(authorize)
    registerContentAdapter(adapter)

    const ctx = ctxFor(
      contentType({ capabilities: { write: 'posts:publish' } })
    )
    await expect(listContentRevisions(ctx, 'hello')).rejects.toThrow(
      'forbidden'
    )
    await expect(getContentRevision(ctx, 'hello', 'abc123')).rejects.toThrow(
      'forbidden'
    )
    expect(authorize).toHaveBeenCalledWith(fakeEvent, 'posts:publish')
    expect(listRevisions).not.toHaveBeenCalled()
    expect(getRevision).not.toHaveBeenCalled()
  })
})

describe('content backups', () => {
  const record = {
    v: 1,
    savedAt: Date.now(),
    device: 'device-a',
    tab: 'tab-a',
    changes: {
      title: { base: 'Old', value: 'New' },
      // Not a declared field: the handler drops it.
      other: { base: 1, value: 2 },
    },
  }
  const body = JSON.stringify(record)
  const user = (userId: string) =>
    ({ context: { userId } }) as unknown as H3Event
  const ctxOf = (event: H3Event, type = contentType()) => ({ event, type })

  it('answers supported: false before any check when the adapter has no backups', async () => {
    const {
      registerContentAdapter,
      getContentBackup,
      putContentBackup,
      removeContentBackup,
    } = await loadHandlers()
    const authorize = vi.fn(async () => {
      throw new Error('forbidden')
    })
    registerContentAdapter(createMemoryContentAdapter({ authorize }))

    const ctx = ctxFor(
      contentType({ capabilities: { write: 'posts:publish' } })
    )
    expect(await getContentBackup(ctx, 'a')).toEqual({ supported: false })
    expect(await putContentBackup(ctx, 'a', body)).toEqual({
      supported: false,
    })
    expect(await removeContentBackup(ctx, 'a')).toEqual({ supported: false })
    expect(authorize).not.toHaveBeenCalled()
  })

  it('needs the write capability of the type', async () => {
    const {
      registerContentAdapter,
      getContentBackup,
      putContentBackup,
      removeContentBackup,
    } = await loadHandlers()
    const authorize = vi.fn(async () => {
      throw new Error('forbidden')
    })
    const adapter = createMemoryContentAdapter({ authorize, backups: true })
    const get = vi.spyOn(adapter.backups!, 'get')
    registerContentAdapter(adapter)

    const ctx = ctxFor(
      contentType({ capabilities: { write: 'posts:publish' } })
    )
    await expect(getContentBackup(ctx, 'a')).rejects.toThrow('forbidden')
    await expect(putContentBackup(ctx, 'a', body)).rejects.toThrow('forbidden')
    await expect(removeContentBackup(ctx, 'a')).rejects.toThrow('forbidden')
    expect(authorize).toHaveBeenCalledWith(fakeEvent, 'posts:publish')
    expect(get).not.toHaveBeenCalled()
  })

  it('stores, reads and removes a copy; no id means +new', async () => {
    const {
      registerContentAdapter,
      getContentBackup,
      putContentBackup,
      removeContentBackup,
    } = await loadHandlers()
    const adapter = createMemoryContentAdapter({ backups: true })
    const put = vi.spyOn(adapter.backups!, 'put')
    const remove = vi.spyOn(adapter.backups!, 'remove')
    registerContentAdapter(adapter)

    const ctx = ctxOf(user('u1'))
    expect(await getContentBackup(ctx)).toEqual({
      supported: true,
      backup: null,
    })
    expect(await putContentBackup(ctx, undefined, body)).toEqual({
      supported: true,
      otherDevice: false,
    })
    expect(put).toHaveBeenCalledWith(ctx, '+new', expect.anything())
    // The undeclared field is gone.
    const saved = (await getContentBackup(ctx)).backup
    expect(Object.keys(saved!.changes)).toEqual(['title'])
    expect(await getContentBackup(ctx, 'a/b')).toEqual({
      supported: true,
      backup: null,
    })

    expect(await removeContentBackup(ctx)).toEqual({ supported: true })
    expect(remove).toHaveBeenCalledWith(ctx, '+new')
    expect((await getContentBackup(ctx)).backup).toBeNull()
  })

  it('keeps one map for each caller', async () => {
    const { registerContentAdapter, getContentBackup, putContentBackup } =
      await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter({ backups: true }))

    await putContentBackup(ctxOf(user('u1')), 'a', body)
    expect((await getContentBackup(ctxOf(user('u1')), 'a')).backup).not.toBe(
      null
    )
    expect((await getContentBackup(ctxOf(user('u2')), 'a')).backup).toBeNull()
  })

  it('refuses a body over the size limit with 413', async () => {
    const { registerContentAdapter, putContentBackup } = await loadHandlers()
    const adapter = createMemoryContentAdapter({ backups: true })
    const put = vi.spyOn(adapter.backups!, 'put')
    registerContentAdapter(adapter)

    await expect(
      putContentBackup(ctxFor(contentType()), 'a', 'x'.repeat(1_000_001))
    ).rejects.toThrow(expect.objectContaining({ statusCode: 413 }))
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a bad shape with 400', async () => {
    const { registerContentAdapter, putContentBackup } = await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter({ backups: true }))

    const ctx = ctxFor(contentType())
    for (const bad of [
      undefined,
      '',
      'not json',
      '[]',
      JSON.stringify({ ...record, v: 2 }),
      JSON.stringify({ ...record, device: '' }),
      JSON.stringify({ ...record, savedAt: 1 }),
    ]) {
      await expect(putContentBackup(ctx, 'a', bad)).rejects.toThrow(
        expect.objectContaining({ statusCode: 400 })
      )
    }
  })

  it('reports otherDevice when another device wrote the copy before', async () => {
    const { registerContentAdapter, putContentBackup } = await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter({ backups: true }))

    const ctx = ctxOf(user('u1'))
    expect((await putContentBackup(ctx, 'a', body)).otherDevice).toBe(false)
    expect((await putContentBackup(ctx, 'a', body)).otherDevice).toBe(false)
    const other = JSON.stringify({ ...record, device: 'device-b' })
    expect((await putContentBackup(ctx, 'a', other)).otherDevice).toBe(true)
  })

  it('removes the copy of the caller after a create, an update and a delete', async () => {
    const {
      registerContentAdapter,
      putContentBackup,
      getContentBackup,
      createContentItem,
      updateContentItem,
      deleteContentItem,
    } = await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter({ backups: true }))

    const ctx = ctxOf(user('u1'))
    const exists = async (id?: string) =>
      (await getContentBackup(ctx, id)).backup !== null

    await putContentBackup(ctx, undefined, body)
    const created = await createContentItem(ctx, { title: 'Hello' })
    expect(await exists()).toBe(false)

    const id = String(created.id)
    await putContentBackup(ctx, id, body)
    await updateContentItem(ctx, id, { title: 'Again' })
    expect(await exists(id)).toBe(false)

    await putContentBackup(ctx, id, body)
    await deleteContentItem(ctx, id)
    expect(await exists(id)).toBe(false)
  })

  it('does not fail a save when the removal throws', async () => {
    const {
      registerContentAdapter,
      createContentItem,
      updateContentItem,
      deleteContentItem,
    } = await loadHandlers()
    const adapter = createMemoryContentAdapter({ backups: true })
    adapter.backups!.remove = vi.fn(async () => {
      throw new Error('database down')
    })
    registerContentAdapter(adapter)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const ctx = ctxFor(contentType())
    const created = await createContentItem(ctx, { title: 'Hello' })
    await expect(
      updateContentItem(ctx, created.id, { title: 'Again' })
    ).resolves.toMatchObject({ title: 'Again' })
    await expect(deleteContentItem(ctx, created.id)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})

describe('the trash', () => {
  function fakeTrash() {
    return {
      move: vi.fn(async () => {}),
      list: vi.fn(async () => ({
        data: [{ id: 'a', _deletedAt: 'x' }],
        total: 1,
      })),
      restore: vi.fn(async (_ctx: unknown, id: string | number) => ({ id })),
      purge: vi.fn(async () => {}),
      purgeBefore: vi.fn(async () => 2),
    }
  }

  it('moves the item to the trash for a type with trash, and removes it for a type without', async () => {
    const { registerContentAdapter, deleteContentItem } = await loadHandlers()
    const trash = fakeTrash()
    const adapter = { ...createMemoryContentAdapter(), trash }
    const remove = vi.spyOn(adapter, 'remove')
    registerContentAdapter(adapter)

    await deleteContentItem(ctxFor(contentType({ trash: true })), 'a')
    expect(trash.move).toHaveBeenCalledWith(expect.anything(), 'a')
    expect(remove).not.toHaveBeenCalled()

    const plain = ctxFor(contentType())
    const created = await adapter.create(plain, { title: 'Hello' })
    await deleteContentItem(plain, created.id)
    expect(remove).toHaveBeenCalledWith(plain, created.id)
  })

  it('purges the items older than 30 days, then lists the trash', async () => {
    const { registerContentAdapter, listTrashItems, trashCutoff } =
      await loadHandlers()
    const trash = fakeTrash()
    registerContentAdapter({ ...createMemoryContentAdapter(), trash })
    const ctx = ctxFor(contentType({ trash: true }))

    const result = await listTrashItems(ctx, { limit: 10, search: 'x' })

    expect(result.total).toBe(1)
    const before = trash.purgeBefore.mock.calls[0]![1] as unknown as string
    expect(Date.parse(before)).toBeLessThan(Date.now() - 29 * 864e5)
    expect(Date.parse(before)).toBeGreaterThan(Date.now() - 31 * 864e5)
    expect(trash.list).toHaveBeenCalledWith(ctx, { limit: 10, search: 'x' })
    expect(trashCutoff(new Date('2026-03-31T00:00:00Z'))).toBe(
      '2026-03-01T00:00:00.000Z'
    )
  })

  it('still lists the trash when the purge fails', async () => {
    const { registerContentAdapter, listTrashItems } = await loadHandlers()
    const trash = fakeTrash()
    trash.purgeBefore.mockRejectedValueOnce(new Error('offline'))
    registerContentAdapter({ ...createMemoryContentAdapter(), trash })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(
      listTrashItems(ctxFor(contentType({ trash: true })), {})
    ).resolves.toMatchObject({ total: 1 })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('restores, purges and empties, each with the delete capability', async () => {
    const {
      registerContentAdapter,
      restoreTrashItem,
      purgeTrashItem,
      emptyTrash,
    } = await loadHandlers()
    const trash = fakeTrash()
    const authorize = vi.fn(async () => {})
    registerContentAdapter({
      ...createMemoryContentAdapter({ authorize }),
      trash,
    })
    const ctx = ctxFor(
      contentType({ trash: true, capabilities: { delete: 'posts:delete' } })
    )

    expect(await restoreTrashItem(ctx, 'a')).toEqual({ id: 'a' })
    await purgeTrashItem(ctx, 'a')
    const now = new Date('2026-05-01T00:00:00Z')
    expect(await emptyTrash(ctx, now)).toEqual({ purged: 2 })

    expect(trash.purge).toHaveBeenCalledWith(ctx, 'a')
    expect(trash.purgeBefore).toHaveBeenCalledWith(
      ctx,
      '2026-05-01T00:00:01.000Z'
    )
    expect(authorize).toHaveBeenCalledTimes(3)
    expect(authorize).toHaveBeenCalledWith(fakeEvent, 'posts:delete')
  })

  it('answers 404 for a type with no trash, and 501 for an adapter with none', async () => {
    const { registerContentAdapter, listTrashItems, restoreTrashItem } =
      await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter())

    await expect(
      listTrashItems(ctxFor(contentType()), {})
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      restoreTrashItem(ctxFor(contentType({ trash: true })), 'a')
    ).rejects.toMatchObject({ statusCode: 501 })
  })
})

describe('the scheduled purge', () => {
  it('purges every type with trash as a system request, and a failing type only warns', async () => {
    const { registerContentAdapter, registerContentType, purgeExpiredTrash } =
      await loadHandlers()
    const { isPlutoSystemEvent } = await import('../server/utils/pluto-system')
    const purgeBefore = vi.fn(
      async (ctx: PlutoContentContext, _before: string) => {
        if (ctx.type.name === 'tag') {
          throw new Error('no token')
        }
        return 2
      }
    )
    registerContentAdapter({
      ...createMemoryContentAdapter(),
      trash: {
        move: vi.fn(),
        list: vi.fn(),
        restore: vi.fn(),
        purge: vi.fn(),
        purgeBefore,
      },
    })
    registerContentType(contentType({ trash: true }))
    registerContentType(contentType({ name: 'tag', trash: true }))
    registerContentType(contentType({ name: 'note' }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await purgeExpiredTrash(new Date('2026-03-31T00:00:00Z'))

    expect(result).toEqual({ purged: 2, failed: ['tag'] })
    expect(purgeBefore).toHaveBeenCalledTimes(2)
    const [ctx, before] = purgeBefore.mock.calls[0]!
    expect(isPlutoSystemEvent(ctx.event)).toBe(true)
    expect(before).toBe('2026-03-01T00:00:00.000Z')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('does nothing without a trash on the adapter', async () => {
    const { registerContentAdapter, purgeExpiredTrash } = await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter())
    expect(await purgeExpiredTrash()).toEqual({ purged: 0, failed: [] })
  })
})

describe('the scheduled publish', () => {
  const schedule = {
    values: [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ],
    default: 'draft',
    publishedValue: 'published',
    publishedAtColumn: 'publishedAt',
    schedule: true,
  }

  it('publishes every type with a schedule as a system request, and a failing type only warns', async () => {
    const {
      registerContentAdapter,
      registerContentType,
      publishScheduledContent,
    } = await loadHandlers()
    const { isPlutoSystemEvent } = await import('../server/utils/pluto-system')
    const publishDue = vi.fn(async (ctx: PlutoContentContext, _now: string) => {
      if (ctx.type.name === 'page') {
        throw new Error('no token')
      }
      return 3
    })
    registerContentAdapter({ ...createMemoryContentAdapter(), publishDue })
    registerContentType(contentType({ status: schedule }))
    registerContentType(contentType({ name: 'page', status: schedule }))
    // No schedule, or a schedule with no time column: skipped.
    registerContentType(contentType({ name: 'note' }))
    registerContentType(
      contentType({
        name: 'memo',
        status: { ...schedule, publishedAtColumn: undefined },
      })
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await publishScheduledContent(
      new Date('2026-03-31T00:00:00Z')
    )

    expect(result).toEqual({ published: 3, failed: ['page'] })
    expect(publishDue).toHaveBeenCalledTimes(2)
    const [ctx, now] = publishDue.mock.calls[0]!
    expect(isPlutoSystemEvent(ctx.event)).toBe(true)
    expect(now).toBe('2026-03-31T00:00:00.000Z')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('does nothing without publishDue on the adapter', async () => {
    const { registerContentAdapter, publishScheduledContent } =
      await loadHandlers()
    registerContentAdapter(createMemoryContentAdapter())
    expect(await publishScheduledContent()).toEqual({
      published: 0,
      failed: [],
    })
  })
})
