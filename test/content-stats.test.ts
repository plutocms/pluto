import type { PlutoContentType } from '../shared/types/content'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// Same Nuxt-global stubbing as the other composable tests.
// pluto-content-stats.ts uses auto-imported `ref`, `$fetch`, and a sibling
// composable that do not exist outside a Nuxt build.
const contentTypes = ref<{
 type: Partial<PlutoContentType>
}[]>([])
const fetchMock = vi.fn()

beforeEach(() => {
  contentTypes.value = []
  fetchMock.mockReset()
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('usePlutoContentTypes', () => ({ items: contentTypes }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function load() {
  const { usePlutoContentStats } = await import('../app/composables/pluto-content-stats')
  const result = usePlutoContentStats()
  await result.refresh()
  return result
}

describe('usePlutoContentStats', () => {
  it('counts published and drafts for a type with a status workflow', async () => {
    contentTypes.value = [{ type: { name: 'post', label: 'Post', labelPlural: 'Posts', basePath: '/admin/posts', status: { values: [] } } }]
    fetchMock.mockImplementation(async (_url: string, opts: {
 query: Record<string, unknown>
}) => ({ data: [], total: opts.query.published ? 7 : 10 }))

    const { stats } = await load()

    expect(stats.value).toEqual([{ name: 'post', label: 'Post', labelPlural: 'Posts', icon: undefined, path: '/admin/posts', total: 10, published: 7, drafts: 3 }])
    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post', { query: { limit: 1 } })
    expect(fetchMock).toHaveBeenCalledWith('/api/_pluto/content/post', { query: { limit: 1, published: 1 } })
  })

  it('counts only the total for a type without a status workflow', async () => {
    contentTypes.value = [{ type: { name: 'faq', label: 'FAQ', labelPlural: 'FAQs', status: false } }]
    fetchMock.mockResolvedValue({ data: [], total: 4 })

    const { stats } = await load()

    expect(stats.value[0]).toMatchObject({ total: 4, path: '/admin/content/faq' })
    expect(stats.value[0]).not.toHaveProperty('published')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to counting rows when the adapter returns no total', async () => {
    contentTypes.value = [{ type: { name: 'faq', label: 'FAQ', labelPlural: 'FAQs' } }]
    fetchMock.mockImplementation(async (_url: string, opts: {
 query: Record<string, unknown>
}) =>
      opts.query.limit ? { data: [{}] } : { data: [{}, {}, {}] }
    )

    const { stats } = await load()

    expect(stats.value[0]!.total).toBe(3)
  })

  it('keeps a failure in error', async () => {
    contentTypes.value = [{ type: { name: 'faq', label: 'FAQ', labelPlural: 'FAQs' } }]
    fetchMock.mockRejectedValue(new Error('boom'))

    const { usePlutoContentStats } = await import('../app/composables/pluto-content-stats')
    const { error, refresh } = usePlutoContentStats()
    await expect(refresh()).rejects.toThrow('boom')
    expect(error.value).toBeInstanceOf(Error)
  })
})
