import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PLUTO_SEO_FIELDS,
  plutoSeoTypeExtension,
  plutoSeoWithFields,
} from '../shared/utils/seo-fields'

// The post type of the Git CMS, in short.
function postType(extra: Record<string, unknown> = {}): any {
  return {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'slug', type: 'slug', label: 'Slug' },
    ],
    api: { public: true },
    ...extra,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pLUTO_SEO_FIELDS', () => {
  it('uses the snake_case columns of the Supabase blog migration', () => {
    const columns = Object.fromEntries(
      PLUTO_SEO_FIELDS.filter((field) => !field.virtual).map((field) => [
        field.name,
        field.column,
      ])
    )
    expect(columns).toEqual({
      seoTitle: 'seo_title',
      seoDescription: 'seo_description',
      seoImage: 'seo_image',
      seoNoindex: 'seo_noindex',
    })
  })

  it('has the types of the plan, in the side column, out of the list', () => {
    const types = Object.fromEntries(
      PLUTO_SEO_FIELDS.map((field) => [field.name, field.type])
    )
    expect(types).toEqual({
      seoPreview: 'text',
      seoTitle: 'text',
      seoDescription: 'textarea',
      seoImage: 'media',
      seoNoindex: 'boolean',
    })
    for (const field of PLUTO_SEO_FIELDS) {
      expect(field.region).toBe('side')
      expect(field.inList).toBe(false)
    }
  })

  it('orders the group last, the preview first', () => {
    expect(PLUTO_SEO_FIELDS.map((field) => field.order)).toEqual([
      900, 901, 902, 903, 904,
    ])
  })

  it('keeps the preview virtual, with the seo-preview widget', () => {
    const preview = PLUTO_SEO_FIELDS[0]
    expect(preview).toMatchObject({
      name: 'seoPreview',
      virtual: true,
      widget: 'seo-preview',
    })
  })

  it('takes images only for the social image', () => {
    const image = PLUTO_SEO_FIELDS.find((field) => field.name === 'seoImage')
    expect(image).toMatchObject({ type: 'media', accept: ['image/*'] })
  })
})

describe('plutoSeoWithFields', () => {
  it('appends the five fields and leaves the type unchanged', () => {
    const type = postType()
    const extended = plutoSeoWithFields(type)
    expect(extended.fields.map((field: any) => field.name)).toEqual([
      'title',
      'slug',
      'seoPreview',
      'seoTitle',
      'seoDescription',
      'seoImage',
      'seoNoindex',
    ])
    expect(type.fields).toHaveLength(2)
    expect(type.files).toBeUndefined()
    expect(extended.name).toBe('post')
    expect(extended.api).toEqual({ public: true })
  })

  it('keeps a field the owner declares, and warns in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const own = { name: 'seoTitle', type: 'text', label: 'Own title' }
    const extended = plutoSeoWithFields(
      postType({ fields: [...postType().fields, own] })
    )
    const titles = extended.fields.filter(
      (field: any) => field.name === 'seoTitle'
    )
    expect(titles).toEqual([own])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"seoTitle"'))
  })

  it('returns the same type when it has every field already', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const full = postType({
      fields: [...postType().fields, ...PLUTO_SEO_FIELDS],
    })
    expect(plutoSeoWithFields(full)).toBe(full)
  })

  it('adds the stored fields to api.fields when the type lists them', () => {
    const extended = plutoSeoWithFields(
      postType({ api: { public: true, fields: ['title', 'slug'] } })
    )
    expect(extended.api.fields).toEqual([
      'title',
      'slug',
      'seoTitle',
      'seoDescription',
      'seoImage',
      'seoNoindex',
    ])
  })

  it('composes the frontmatter hooks: read owner then layer, write layer then owner', () => {
    const calls: string[] = []
    const owner = {
      read: (fm: Record<string, unknown>) => {
        calls.push('owner.read')
        expect(fm.seo_title).toBeUndefined()
        return { ...fm, ownerRead: true }
      },
      write: (fm: Record<string, unknown>) => {
        calls.push('owner.write')
        expect(fm.seo_title).toBeUndefined()
        return { ...fm, ownerWrite: true }
      },
    }
    const type = plutoSeoWithFields(
      postType({ files: { nested: false, frontmatter: owner } })
    )
    expect(type.files.nested).toBe(false)

    const read = type.files.frontmatter.read({ seo: { title: 'T' } })
    expect(read).toMatchObject({ ownerRead: true, seo_title: 'T' })
    const write = type.files.frontmatter.write({ seo_title: 'T2' })
    expect(write).toEqual({ seo: { title: 'T2' }, ownerWrite: true })
    expect(calls).toEqual(['owner.read', 'owner.write'])
  })

  it('works with no owner hooks', () => {
    const type = plutoSeoWithFields(postType())
    expect(type.files.frontmatter.write({ seo_title: 'T' })).toEqual({
      seo: { title: 'T' },
    })
  })
})

describe('plutoSeoTypeExtension', () => {
  it('extends the types that the settings turn on, and no other', () => {
    const extension = plutoSeoTypeExtension({
      types: { post: true, page: false },
    })
    expect(extension.id).toBe('seo')
    expect(extension.extend(postType()).fields).toHaveLength(7)
    const page = postType({ name: 'page' })
    expect(extension.extend(page)).toBe(page)
    const other = postType({ name: 'product' })
    expect(extension.extend(other)).toBe(other)
  })

  it('reads the settings when it runs, so an app can turn a type off', () => {
    const types: Record<string, boolean> = { post: true }
    const extension = plutoSeoTypeExtension({ types })
    types.post = false
    const type = postType()
    expect(extension.extend(type)).toBe(type)
  })
})
