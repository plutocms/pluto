import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// pluto-content-list.ts leans on Nuxt's auto-imported `ref` and the
// Nitro/ofetch global `$fetch`. Outside a Nuxt build nothing injects
// either — stub them the same way test/permissions.test.ts stubs
// `useNuxtApp`/`computed`/`ref`/`useState`.
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('ref', ref)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadComposable() {
  const { usePlutoContentList } = await import('../app/composables/pluto-content-list')
  return { usePlutoContentList }
}

describe('usePlutoContentList', () => {
  it('fetches the list once on creation and exposes the flattened items', async () => {
    fetchMock.mockResolvedValue({ data: [{ id: 1, title: 'Hello' }], total: 1 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post')

    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post')
    expect(list.items.value).toEqual([{ id: 1, title: 'Hello' }])
    expect(list.total.value).toBe(1)
  })

  it('refresh() re-fetches the list', async () => {
    fetchMock.mockResolvedValue({ data: [], total: 0 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post')
    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    await list.refresh()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('remove() calls DELETE for the given id, then refreshes', async () => {
    fetchMock.mockResolvedValueOnce({ data: [{ id: 1 }], total: 1 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post')
    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    fetchMock.mockResolvedValueOnce(undefined) // the DELETE call
    fetchMock.mockResolvedValueOnce({ data: [], total: 0 }) // the refresh() call

    await list.remove(1)

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/_pluto/content/post/1', { method: 'DELETE' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(list.items.value).toEqual([])
  })

  it('surfaces a refresh() rejection through error, and rethrows', async () => {
    const failure = new Error('network down')
    fetchMock.mockRejectedValue(failure)
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post')

    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    expect(list.error.value).toBe(failure)
    await expect(list.refresh()).rejects.toThrow('network down')
  })

  it('surfaces a remove() rejection through error, and rethrows, without refreshing', async () => {
    fetchMock.mockResolvedValueOnce({ data: [{ id: 1 }], total: 1 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post')
    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    const failure = new Error('forbidden')
    fetchMock.mockRejectedValueOnce(failure)

    await expect(list.remove(1)).rejects.toThrow('forbidden')
    expect(list.error.value).toBe(failure)
    // Only the initial list fetch plus the failed DELETE — no refresh() follow-up.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('usePlutoContentList with pageSize', () => {
  const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: from + i }))

  it('fetches the first page with limit and offset', async () => {
    fetchMock.mockResolvedValue({ data: rows(1, 2), total: 5 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post', { pageSize: 2 })
    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post', { query: { limit: 2, offset: 0 } })
    expect(list.items.value).toHaveLength(2)
    expect(list.hasMore.value).toBe(true)
  })

  it('loadMore() appends the next page until the total is reached', async () => {
    fetchMock
      .mockResolvedValueOnce({ data: rows(1, 2), total: 3 })
      .mockResolvedValueOnce({ data: rows(3, 1), total: 3 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post', { pageSize: 2 })
    await vi.waitFor(() => expect(list.pending.value).toBe(false))
    await list.loadMore()

    expect(fetchMock).toHaveBeenLastCalledWith('/api/_pluto/content/post', { query: { limit: 2, offset: 2 } })
    expect(list.items.value.map((item) => item.id)).toEqual([1, 2, 3])
    expect(list.hasMore.value).toBe(false)

    await list.loadMore()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('without a total, a full page means there may be another one', async () => {
    fetchMock
      .mockResolvedValueOnce({ data: rows(1, 2) })
      .mockResolvedValueOnce({ data: rows(3, 1) })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post', { pageSize: 2 })
    await vi.waitFor(() => expect(list.pending.value).toBe(false))
    expect(list.hasMore.value).toBe(true)

    await list.loadMore()
    expect(list.hasMore.value).toBe(false)
  })

  it('remove() drops the row in place, without a refetch', async () => {
    fetchMock.mockResolvedValueOnce({ data: rows(1, 2), total: 5 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post', { pageSize: 2 })
    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    fetchMock.mockResolvedValueOnce(undefined)
    await list.remove(1)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(list.items.value.map((item) => item.id)).toEqual([2])
    expect(list.total.value).toBe(4)
  })

  it('drops a page that finishes after a newer refresh()', async () => {
    let resolveFirst!: (value: unknown) => void
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => {
 resolveFirst = resolve
}))
      .mockResolvedValueOnce({ data: rows(10, 1), total: 1 })
    const { usePlutoContentList } = await loadComposable()

    const list = usePlutoContentList('post', { pageSize: 2 })
    await list.refresh()
    resolveFirst({ data: rows(1, 2), total: 5 })
    await vi.waitFor(() => expect(list.pending.value).toBe(false))

    expect(list.items.value.map((item) => item.id)).toEqual([10])
  })
})
