import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import { createMarkdownContentAdapter } from '../../../../core/modules/pluto-github/runtime/server/adapter'
import { createMemoryStore } from '../../../../core/modules/pluto-github/runtime/server/store/memory'
import { parseMarkdownFile } from '../../../../core/modules/pluto-github/runtime/server/utils/markdown-file'
import { plutoGithubPostType } from '../../../../core/modules/pluto-github/runtime/shared/post-type'
import {
  extendContentTypes,
  getContentType,
  registerContentAdapter,
  registerContentType,
} from '../../../../core/server/utils/pluto-content'
import { registerMediaDriver } from '../../../../core/server/utils/pluto-media-driver'
import { toPublicData } from '../../../../core/server/utils/pluto-public-api'
import { validateContentPayload } from '../../../../core/shared/utils/content-validate'
import { plutoSeoTypeExtension } from '../shared/utils/seo-fields'

// The Git CMS round trip, over the memory store of core: the extended post type writes the `seo:`
// block of the file and reads it back. The layer keeps core as it is.

vi.mock('../../../../core/server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

const event = {} as H3Event
const PATH = 'content/posts/hello.md'

const type = plutoSeoTypeExtension({ types: { post: true } }).extend(
  plutoGithubPostType
)

function setup(files: Record<string, string> = {}) {
  const store = createMemoryStore(files)
  const adapter = createMarkdownContentAdapter({
    store,
    dir: 'content',
    now: () => new Date('2026-03-01T00:00:00Z'),
    getAccess: async () => ({
      capabilities: ['posts:read_drafts', 'posts:publish', 'posts:delete'],
      auth: { token: 't' },
    }),
  })
  const ctx = { event, type }
  const frontmatter = async () => {
    const file = await store.readFile(PATH, await store.head())
    return parseMarkdownFile(file!.text).frontmatter
  }
  const text = async () =>
    (await store.readFile(PATH, await store.head()))!.text
  return { store, adapter, ctx, frontmatter, text }
}

describe('git CMS round trip of the SEO fields', () => {
  it('writes a seo block and no flat key', async () => {
    const { adapter, ctx, frontmatter, text } = setup()
    await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      content: 'Body',
      seoTitle: 'A short title',
      seoDescription: 'One line for Google.',
      seoImage: 'red-mug-k3j9a',
      seoNoindex: true,
    })

    expect((await frontmatter()).seo).toEqual({
      title: 'A short title',
      description: 'One line for Google.',
      image: 'red-mug-k3j9a',
      noindex: true,
    })
    expect(await text()).not.toContain('seo_')
    expect(await text()).not.toContain('seoTitle')
    expect(await text()).toMatch(/^seo:\n {2}title: A short title$/m)
  })

  it('accepts the payload of an empty form, and one with every SEO field', () => {
    const empty = {
      title: 'Hello',
      seoPreview: '',
      seoTitle: '',
      seoDescription: '',
      seoImage: null,
      seoNoindex: false,
    }
    expect(validateContentPayload(type, empty)).toEqual([])
    expect(
      validateContentPayload(type, {
        title: 'Hello',
        seoTitle: 'T',
        seoDescription: 'D',
        seoImage: 'red-mug-k3j9a',
        seoNoindex: true,
      })
    ).toEqual([])
  })

  it('does not write the preview, an empty value or noindex false', async () => {
    const { adapter, ctx, frontmatter } = setup()
    await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      seoPreview: 'ignored',
      seoTitle: '',
      seoNoindex: false,
    })

    const fm = await frontmatter()
    expect(fm.seo).toBeUndefined()
    expect(fm.seoPreview).toBeUndefined()
    expect(Object.keys(fm).some((key) => key.startsWith('seo'))).toBe(false)
  })

  it('reads the fields back as an item, with the field names', async () => {
    const { adapter, ctx } = setup()
    await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      status: 'published',
      seoTitle: 'A short title',
      seoNoindex: true,
    })

    const item = await adapter.get(ctx, 'hello')
    expect(item).toMatchObject({
      seoTitle: 'A short title',
      seoNoindex: true,
    })
    expect(item).not.toHaveProperty('seoPreview')
    expect(item).not.toHaveProperty('seo_title')
  })

  it('reads a hand-written seo block and keeps its unknown keys on update', async () => {
    const written =
      '---\ntitle: Old\nstatus: published\nseo:\n  title: Hand title\n  description: Hand text\n  canonical: https://a.io/old\n---\nText\n'
    const { adapter, ctx, frontmatter } = setup({ [PATH]: written })

    const item = await adapter.get(ctx, 'hello')
    expect(item).toMatchObject({
      seoTitle: 'Hand title',
      seoDescription: 'Hand text',
    })

    await adapter.update(ctx, 'hello', { title: 'New' })
    expect((await frontmatter()).seo).toEqual({
      title: 'Hand title',
      description: 'Hand text',
      canonical: 'https://a.io/old',
    })

    await adapter.update(ctx, 'hello', { seoTitle: '' })
    expect((await frontmatter()).seo).toEqual({
      description: 'Hand text',
      canonical: 'https://a.io/old',
    })
  })

  it('removes the whole block when the author clears every field', async () => {
    const { adapter, ctx, frontmatter } = setup()
    await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      seoTitle: 'T',
      seoNoindex: true,
    })
    await adapter.update(ctx, 'hello', { seoTitle: '', seoNoindex: false })

    expect((await frontmatter()).seo).toBeUndefined()
  })

  it('keeps the seo block when the update does not send the SEO fields', async () => {
    const { adapter, ctx, frontmatter } = setup()
    await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      seoTitle: 'T',
      seoNoindex: true,
    })
    await adapter.update(ctx, 'hello', { title: 'Hello again' })

    expect((await frontmatter()).seo).toEqual({ title: 'T', noindex: true })
  })

  it('gives seoImage as a record in the public answer', async () => {
    const { adapter } = setup()
    registerContentType(plutoGithubPostType)
    extendContentTypes(plutoSeoTypeExtension({ types: { post: true } }))
    registerContentAdapter(adapter)
    registerMediaDriver({
      get: async (_event: H3Event, ids: string[]) =>
        ids.map((id) => ({
          id,
          url: `/media/${id}.webp`,
          name: `${id}.webp`,
          mimeType: 'image/webp',
          size: 1,
          width: 1200,
          height: 630,
          alt: 'A red mug',
        })),
    } as never)

    const publicType = getContentType('post')!
    const ctx = { event, type: publicType }
    const created = await adapter.create(ctx, {
      title: 'Hello',
      slug: 'hello',
      status: 'published',
      seoTitle: 'T',
      seoImage: 'red-mug-k3j9a',
    })
    const item = await adapter.get(ctx, created.id as string)
    const data = await toPublicData(ctx, item!, 'item')

    expect(data.seoTitle).toBe('T')
    expect(data.seoImage).toMatchObject({
      id: 'red-mug-k3j9a',
      url: '/media/red-mug-k3j9a.webp',
      width: 1200,
      height: 630,
      alt: 'A red mug',
    })
    expect(data).not.toHaveProperty('seoPreview')
    expect(data).not.toHaveProperty('seo_title')
  })
})
