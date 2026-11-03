import type { PlutoContentType } from '../shared/types/content'
import type { PlutoMedia } from '../shared/types/media'
import { describe, expect, it } from 'vitest'
import {
  previewMediaIds,
  toPreviewItem,
} from '../shared/utils/content-preview'

function postType(overrides: Partial<PlutoContentType> = {}): PlutoContentType {
  return {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'text', label: 'Title' },
      { name: 'cover', type: 'media', label: 'Cover' },
      { name: 'gallery', type: 'media', label: 'Gallery', multiple: true },
    ],
    ...overrides,
  }
}

function record(id: string): PlutoMedia {
  return {
    id,
    url: `/media/${id}.webp`,
    name: `${id}.webp`,
    mimeType: 'image/webp',
    size: 1,
    width: 10,
    height: 10,
    alt: '',
    createdAt: '2026-01-01T00:00:00Z',
    preview: null,
  }
}

describe('toPreviewItem', () => {
  it('puts the dates of a Supabase type under the public keys', () => {
    const type = postType({
      timestamps: { created: 'created_at', updated: 'updated_at' },
      status: {
        column: 'status',
        default: 'draft',
        publishedValue: 'published',
        publishedAtColumn: 'published_at',
        values: [],
      },
    })
    const item = toPreviewItem(
      type,
      {
        title: 'Hi',
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
        published_at: '2026-01-03',
      },
      '<p>Body</p>'
    )
    expect(item).toMatchObject({
      title: 'Hi',
      html: '<p>Body</p>',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      publishedAt: '2026-01-03',
    })
  })

  it('keeps the dates of the Git CMS, and leaves out a missing date', () => {
    const item = toPreviewItem(
      postType(),
      { title: 'Hi', createdAt: '2026-01-01', publishedAt: '' },
      ''
    )
    expect(item.createdAt).toBe('2026-01-01')
    expect('publishedAt' in item).toBe(false)
    expect('updatedAt' in item).toBe(false)
  })

  it('gives a media field its record, an array for multiple, and null for a missing file', () => {
    const media = new Map([
      ['a', record('a')],
      ['b', record('b')],
    ])
    const type = postType()
    expect(
      toPreviewItem(type, { cover: 'a', gallery: ['b', 'gone', 'a'] }, '', media)
    ).toMatchObject({ cover: media.get('a'), gallery: [media.get('b'), media.get('a')] })
    expect(toPreviewItem(type, { cover: 'gone' }, '', media).cover).toBeNull()
    expect(toPreviewItem(type, {}, '').gallery).toEqual([])
  })
})

describe('previewMediaIds', () => {
  it('lists the ids of every media field once', () => {
    expect(
      previewMediaIds(postType(), { cover: 'a', gallery: ['b', 'a'], title: 'x' })
    ).toEqual(['a', 'b'])
  })
})
