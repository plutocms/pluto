import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { createMarkdownContentAdapter } from '../modules/pluto-github/runtime/server/adapter'
import { createMemoryStore } from '../modules/pluto-github/runtime/server/store/memory'
import { plutoGithubPageType } from '../modules/pluto-github/runtime/shared/page-type'
import pagesModule from '../modules/pluto-pages'
import { definePlutoPageType } from '../shared/utils/page-type'

async function run(options: Record<string, unknown>) {
  const nuxt = { options: { runtimeConfig: { public: {} } } } as any
  await pagesModule(options, nuxt)
  return nuxt.options.runtimeConfig.public.plutoPages
}

describe('the plutoPages module', () => {
  it('is off by default', async () => {
    expect(await run({})).toEqual({ enabled: false })
  })

  it('exposes the option', async () => {
    expect(await run({ enabled: true })).toEqual({ enabled: true })
  })
})

describe('definePlutoPageType', () => {
  const type = definePlutoPageType({
    source: 'pages',
    publishedAtColumn: 'published_at',
    timestamps: { created: 'created_at', updated: 'updated_at' },
    status: { schedule: true },
  })

  it('has a layout select: default or full, default is default', () => {
    expect(type.fields.find((field) => field.name === 'layout')).toMatchObject({
      type: 'select',
      default: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Full width', value: 'full' },
      ],
    })
  })

  it('has the shared fields', () => {
    expect(type.name).toBe('page')
    expect(type.fields.map((field) => field.name)).toEqual([
      'title',
      'slug',
      'description',
      'layout',
      'body',
    ])
    expect(type).toMatchObject({ source: 'pages', api: { public: true } })
  })

  it('merges the status of the backend', () => {
    expect(type.status).toMatchObject({
      publishedAtColumn: 'published_at',
      schedule: true,
    })
  })

  it('links a published page by its path', () => {
    expect(
      type.previewUrl?.({ id: 'x', slug: 'about/team', status: 'published' })
    ).toBe('/about/team')
    expect(
      type.previewUrl?.({ id: 'x', slug: 'about', status: 'draft' })
    ).toBeUndefined()
  })
})

describe('the layout field in the Git CMS', () => {
  it('is written as frontmatter and read back', async () => {
    const store = createMemoryStore()
    const adapter = createMarkdownContentAdapter({
      store,
      dir: 'content',
      getAccess: async () => ({
        capabilities: ['pages:read_drafts', 'pages:publish', 'pages:delete'],
        auth: { token: 't' },
      }),
    })
    const ctx = { event: {} as H3Event, type: plutoGithubPageType }

    await adapter.create(ctx, {
      title: 'Landing',
      slug: 'landing',
      layout: 'full',
      content: 'Body',
    })

    const item = await adapter.get(ctx, 'landing')
    const files = await store.listDir('content/pages', await store.head({}))

    expect(item).toMatchObject({ layout: 'full' })
    expect(files[0]?.text).toContain('layout: full')
  })
})
