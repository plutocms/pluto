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
