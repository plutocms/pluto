import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  plutoSeoCount,
  plutoSeoMarkdownText,
  plutoSeoPreviewImageId,
  plutoSeoPreviewText,
  plutoSeoSearchCard,
} from '../shared/utils/seo-preview'

const type: any = {
  name: 'post',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'richtext' },
    { name: 'cover', type: 'media' },
    { name: 'gallery', type: 'media', multiple: true },
    { name: 'seoImage', type: 'media' },
  ],
}

describe('plutoSeoMarkdownText', () => {
  it('removes the marks of Markdown', () => {
    expect(
      plutoSeoMarkdownText(
        '# Title\n\nSome **bold** and _em_ with [a link](https://a.io) and `code`.\n\n![img](x.png)\n\n- one\n- two\n\n```js\nskip()\n```\n'
      )
    ).toBe('Title Some bold and em with a link and code. one two')
  })
})

describe('plutoSeoPreviewText', () => {
  it('takes the SEO values first', () => {
    expect(
      plutoSeoPreviewText(
        {
          title: 'T',
          seoTitle: 'S',
          excerpt: 'E',
          seoDescription: 'D',
          content: 'Body',
        },
        type
      )
    ).toEqual({ title: 'S', description: 'D' })
  })

  it('falls back to the title, the excerpt, then the start of the body', () => {
    expect(
      plutoSeoPreviewText({ title: 'T', excerpt: 'E', content: 'Body' }, type)
    ).toEqual({ title: 'T', description: 'E' })
    expect(
      plutoSeoPreviewText(
        { title: 'T', content: '# Head\n\nThe **body**.' },
        type
      )
    ).toEqual({ title: 'T', description: 'Head The body.' })
  })

  it('cuts the body at 160 characters', () => {
    const { description } = plutoSeoPreviewText(
      { title: 'T', content: 'word '.repeat(100) },
      type
    )
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description.endsWith('…')).toBe(true)
  })

  it('gives empty texts for an empty item', () => {
    expect(plutoSeoPreviewText({}, type)).toEqual({
      title: '',
      description: '',
    })
    expect(plutoSeoPreviewText({})).toEqual({ title: '', description: '' })
  })
})

describe('plutoSeoPreviewImageId', () => {
  it('takes seoImage, then cover, then another media field', () => {
    expect(
      plutoSeoPreviewImageId(
        { seoImage: 's', cover: 'c', gallery: ['g'] },
        type
      )
    ).toBe('s')
    expect(plutoSeoPreviewImageId({ cover: 'c', gallery: ['g'] }, type)).toBe(
      'c'
    )
    expect(plutoSeoPreviewImageId({ gallery: ['g1', 'g2'] }, type)).toBe('g1')
  })

  it('gives undefined when no field has a file', () => {
    expect(plutoSeoPreviewImageId({ cover: '', gallery: [] }, type)).toBe(
      undefined
    )
    expect(plutoSeoPreviewImageId({}, type)).toBe(undefined)
  })
})

describe('plutoSeoCount', () => {
  it('flags a text over the limit', () => {
    expect(plutoSeoCount('abc', 3)).toEqual({ length: 3, max: 3, over: false })
    expect(plutoSeoCount('abcd', 3).over).toBe(true)
  })
})

describe('plutoSeoSearchCard', () => {
  it('splits the URL into the host and the path segments', () => {
    const card = plutoSeoSearchCard({
      title: 'T',
      description: 'D',
      url: 'https://a.io/repo/posts/hello',
    })
    expect(card).toMatchObject({
      host: 'a.io',
      segments: ['repo', 'posts', 'hello'],
      title: 'T',
      description: 'D',
    })
  })

  it('has no host and no path without a URL', () => {
    expect(
      plutoSeoSearchCard({ title: 'T', description: 'D', url: '' })
    ).toMatchObject({ host: '', segments: [] })
  })

  it('cuts the title at 60 and the description at 160, and counts the real length', () => {
    const card = plutoSeoSearchCard({
      title: 'word '.repeat(20).trim(),
      description: 'sentence '.repeat(30).trim(),
      url: '',
    })
    expect(card.title.length).toBeLessThanOrEqual(60)
    expect(card.title.endsWith('…')).toBe(true)
    expect(card.description.length).toBeLessThanOrEqual(160)
    expect(card.titleCount).toEqual({ length: 99, max: 60, over: true })
    expect(card.descriptionCount).toMatchObject({ length: 269, over: true })
  })

  it('keeps a title with angle brackets as it is', () => {
    expect(
      plutoSeoSearchCard({ title: 'a < b > c', description: '', url: '' }).title
    ).toBe('a < b > c')
  })
})

describe('the texts of the layer', () => {
  const load = (code: string) =>
    JSON.parse(
      readFileSync(
        new URL(`../i18n/locales/${code}.json`, import.meta.url),
        'utf8'
      )
    )

  const keys = (tree: Record<string, any>, prefix = ''): string[] =>
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'object'
        ? keys(value, `${prefix}${key}.`)
        : [`${prefix}${key}`]
    )
  const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
  const read = (tree: any, path: string) =>
    path.split('.').reduce((node, key) => node?.[key], tree) as string

  it('has the same keys and placeholders in en and pt-BR, with no empty text', () => {
    const en = load('en')
    const pt = load('pt-BR')
    expect(keys(pt).sort()).toEqual(keys(en).sort())
    for (const key of keys(en)) {
      expect(read(en, key).trim(), key).not.toBe('')
      expect(read(pt, key).trim(), key).not.toBe('')
      expect(placeholders(read(pt, key)), key).toEqual(
        placeholders(read(en, key))
      )
    }
  })

  it('keeps the field text of the post type under content.post.fields', () => {
    const en = load('en')
    for (const name of [
      'seoPreview',
      'seoTitle',
      'seoDescription',
      'seoImage',
      'seoNoindex',
    ]) {
      expect(en.content.post.fields[name].label).toBeTypeOf('string')
    }
    expect(Object.keys(en).sort()).toEqual(['content', 'seo'])
  })
})
