import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, toValue } from 'vue'
import { contentIdPath } from '../shared/utils/content-id'

// pluto-content-item.ts leans on Nuxt's auto-imported `ref`/`toValue` and
// the Nitro/ofetch global `$fetch`. Outside a Nuxt build nothing injects
// either — stub them the same way test/permissions.test.ts stubs its own
// set of Nuxt globals.
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('toValue', toValue)
  vi.stubGlobal('contentIdPath', contentIdPath)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadComposable() {
  const { usePlutoContentItem } = await import('../app/composables/pluto-content-item')
  return { usePlutoContentItem }
}

describe('usePlutoContentItem', () => {
  it('keeps the slashes of a nested id and encodes each segment', async () => {
    fetchMock.mockResolvedValue({ id: '1.start/a b', title: 'Nested' })
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('doc', '1.start/a b')

    await vi.waitFor(() => expect(entry.pending.value).toBe(false))

    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/doc/1.start/a%20b')
  })

  it('fetches the item once when an id is given', async () => {
    fetchMock.mockResolvedValue({ id: 1, title: 'Hello' })
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', 1)

    await vi.waitFor(() => expect(entry.pending.value).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post/1')
    expect(entry.item.value).toEqual({ id: 1, title: 'Hello' })
  })

  it('never fetches, and starts from an empty object, when no id is given', async () => {
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', undefined)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(entry.item.value).toEqual({})
    expect(entry.pending.value).toBe(false)
  })

  it('refresh() is a no-op in "new entry" mode', async () => {
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', undefined)
    await entry.refresh()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('save() POSTs when there is no id, and updates item with the response', async () => {
    const created = { id: 5, title: 'New' }
    fetchMock.mockResolvedValue(created)
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', undefined)
    const result = await entry.save({ title: 'New' })

    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post', {
      method: 'POST',
      body: { title: 'New' },
    })
    expect(result).toEqual(created)
    expect(entry.item.value).toEqual(created)
  })

  it('save() PATCHes the given id when one is present', async () => {
    fetchMock.mockResolvedValueOnce({ id: 1, title: 'Hello' }) // the initial GET
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', 1)
    await vi.waitFor(() => expect(entry.pending.value).toBe(false))

    fetchMock.mockResolvedValueOnce({ id: 1, title: 'Updated' })
    const result = await entry.save({ title: 'Updated' })

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/_pluto/content/post/1', {
      method: 'PATCH',
      body: { title: 'Updated' },
    })
    expect(result).toEqual({ id: 1, title: 'Updated' })
  })

  it('remove() calls DELETE for the given id', async () => {
    fetchMock.mockResolvedValueOnce({ id: 1, title: 'Hello' }) // the initial GET
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', 1)
    await vi.waitFor(() => expect(entry.pending.value).toBe(false))

    fetchMock.mockResolvedValueOnce(undefined)
    await entry.remove()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/_pluto/content/post/1', { method: 'DELETE' })
  })

  it('remove() rejects without calling $fetch when there is no id yet', async () => {
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', undefined)

    await expect(entry.remove()).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a save() rejection through error, and rethrows', async () => {
    const failure = new Error('validation failed')
    fetchMock.mockRejectedValue(failure)
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', undefined)

    await expect(entry.save({ title: '' })).rejects.toThrow('validation failed')
    expect(entry.error.value).toBe(failure)
  })

  it('sets loadError for a failed fetch, not for a failed save', async () => {
    const missing = Object.assign(new Error('not found'), { statusCode: 404 })
    fetchMock.mockRejectedValueOnce(missing)
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', 3)
    await vi.waitFor(() => expect(entry.pending.value).toBe(false))
    expect(entry.loadError.value).toBe(missing)

    fetchMock.mockResolvedValueOnce({ id: 3, title: 'Back' })
    await entry.refresh()
    expect(entry.loadError.value).toBeNull()

    fetchMock.mockRejectedValueOnce(new Error('save failed'))
    await expect(entry.save({ title: 'x' })).rejects.toThrow('save failed')
    expect(entry.loadError.value).toBeNull()
    expect(entry.error.value).toBeInstanceOf(Error)
  })

  it('supports a getter for id, read once via toValue', async () => {
    fetchMock.mockResolvedValue({ id: 9, title: 'Nine' })
    const { usePlutoContentItem } = await loadComposable()

    const entry = usePlutoContentItem('post', () => 9)

    await vi.waitFor(() => expect(entry.pending.value).toBe(false))

    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post/9')
  })
})
