import { describe, expect, it } from 'vitest'
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

  it('has the shared fields', () => {
    expect(type.name).toBe('page')
    expect(type.fields.map((field) => field.name)).toEqual([
      'title',
      'slug',
      'description',
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
