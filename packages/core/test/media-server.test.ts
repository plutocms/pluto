import type { H3Event } from 'h3'
import type {
  PlutoContentAdapter,
  PlutoContentItem,
  PlutoContentType,
} from '../shared/types/content'
import type { PlutoMedia, PlutoMediaDriver } from '../shared/types/media'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  filterMediaRecords,
  matchesMediaType,
  mediaAcceptAttribute,
  mediaComparator,
  mediaFieldIds,
  mediaFileName,
  mediaMaxBytes,
  mediaPreviewFileName,
  mediaTypeFromName,
  resolveMediaLimits,
} from '../shared/utils/media'

vi.mock('../server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))
vi.mock('../server/utils/pluto-media-config', () => ({
  getMediaLimits: () => ({
    allowedTypes: ['image/*'],
    maxUploadBytes: 100,
    typeLimits: {},
  }),
}))

afterEach(() => {
  vi.resetModules()
})

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44,
  0x52, 0, 0, 0, 10, 0, 0, 0, 20, 8, 6, 0, 0, 0, 0, 0, 0, 0,
])

function media(id: string, overrides: Partial<PlutoMedia> = {}): PlutoMedia {
  return {
    id,
    url: `/media/${id}.webp`,
    name: `${id}.jpg`,
    mimeType: 'image/webp',
    size: 10,
    width: 100,
    height: 50,
    alt: '',
    createdAt: `2026-10-0${id.length}T00:00:00.000Z`,
    preview: null,
    ...overrides,
  }
}

function event(): H3Event {
  return {
    context: {},
    node: { res: { setHeader: () => {}, getHeader: () => undefined } },
  } as unknown as H3Event
}

describe('shared media helpers', () => {
  it('matchesMediaType: exact types, families, prefixes; no patterns match all', () => {
    expect(matchesMediaType('image/webp', ['image/*'])).toBe(true)
    expect(matchesMediaType('model/gltf-binary', ['image/*'])).toBe(false)
    expect(matchesMediaType('model/gltf-binary', ['model/'])).toBe(true)
    expect(matchesMediaType('application/pdf', ['application/pdf'])).toBe(true)
    expect(matchesMediaType('application/pdf', [])).toBe(true)
  })

  it('mediaFileName: a slug, the suffix and the extension of the real type', () => {
    expect(mediaFileName('Pão de Mel.JPG', 'image/webp', 'k3j9a')).toBe(
      'pao-de-mel-k3j9a.webp'
    )
    expect(mediaFileName('...', 'model/gltf-binary', 'x')).toBe('file-x.glb')
  })

  it('mediaTypeFromName and mediaAcceptAttribute: the extensions of the known types', () => {
    expect(mediaTypeFromName('Mug Model.GLB')).toBe('model/gltf-binary')
    expect(mediaTypeFromName('photo.jpeg')).toBe('image/jpeg')
    expect(mediaTypeFromName('notes.txt')).toBe('')
    expect(mediaAcceptAttribute(['model/gltf-binary'])).toBe(
      'model/gltf-binary,.glb'
    )
    expect(mediaAcceptAttribute(['image/*'])).toContain('.webp')
  })

  it('resolveMediaLimits: the defaults for missing values, with no 3D model and no SVG', () => {
    const limits = resolveMediaLimits(undefined)
    expect(limits.allowedTypes).toContain('image/webp')
    expect(limits.allowedTypes).not.toContain('model/gltf-binary')
    expect(limits.allowedTypes).not.toContain('image/svg+xml')
    expect(limits.maxUploadBytes).toBe(10 * 1024 * 1024)
    expect(limits.typeLimits).toEqual({})
  })

  it('resolveMediaLimits: a layer adds its types and their limits', () => {
    const limits = resolveMediaLimits({
      extraTypes: ['model/gltf-binary', 'image/webp'],
      typeLimits: { 'model/gltf-binary': 25 * 1024 * 1024, bad: 0 },
    })
    expect(
      limits.allowedTypes.filter((type) => type === 'image/webp')
    ).toHaveLength(1)
    expect(limits.allowedTypes).toContain('model/gltf-binary')
    expect(mediaMaxBytes(limits, 'model/gltf-binary')).toBe(25 * 1024 * 1024)
    expect(mediaMaxBytes(limits, 'image/png')).toBe(10 * 1024 * 1024)
    expect(limits.typeLimits).not.toHaveProperty('bad')
  })

  it('mediaComparator: newest, oldest, name, size', () => {
    const records = [
      media('a', { size: 5, name: 'b.jpg' }),
      media('bb', { size: 9, name: 'a10.jpg' }),
      media('ccc', { size: 1, name: 'a9.jpg' }),
    ]
    const order = (sort?: 'newest' | 'oldest' | 'name' | 'size') =>
      [...records].sort(mediaComparator(sort)).map((r) => r.id)
    expect(order()).toEqual(['ccc', 'bb', 'a'])
    expect(order('oldest')).toEqual(['a', 'bb', 'ccc'])
    expect(order('name')).toEqual(['ccc', 'bb', 'a'])
    expect(order('size')).toEqual(['bb', 'a', 'ccc'])
    expect(mediaPreviewFileName('mug-k3j9a.glb', 'image/webp')).toBe(
      'mug-k3j9a.preview.webp'
    )
  })

  it('mediaFieldIds: one id, a list, numbers as text, no empty values', () => {
    expect(mediaFieldIds('a')).toEqual(['a'])
    expect(mediaFieldIds([1, '', 'b', null])).toEqual(['1', 'b'])
    expect(mediaFieldIds(undefined)).toEqual([])
  })

  it('filterMediaRecords: search, type, newest first, a page and the total', () => {
    const records = [
      media('a'),
      media('bb', { alt: 'A red mug' }),
      media('ccc', {
        mimeType: 'model/gltf-binary',
        width: null,
        height: null,
      }),
    ]
    expect(
      filterMediaRecords(records, { limit: 2, offset: 0 }).data.map((r) => r.id)
    ).toEqual(['ccc', 'bb'])
    expect(filterMediaRecords(records, { limit: 2, offset: 0 }).total).toBe(3)
    expect(
      filterMediaRecords(records, {
        limit: 10,
        offset: 0,
        search: 'mug',
      }).data.map((r) => r.id)
    ).toEqual(['bb'])
    expect(
      filterMediaRecords(records, { limit: 10, offset: 0, type: 'image' }).total
    ).toBe(2)
    expect(
      filterMediaRecords(records, { limit: 10, offset: 0, type: 'model/' })
        .total
    ).toBe(1)
  })
})

describe('prepareMediaUpload', () => {
  it('makes the full record from the bytes: type, size, pixels, a unique name', async () => {
    const { prepareMediaUpload } = await import('../server/utils/pluto-media')
    const upload = prepareMediaUpload(
      { name: 'Photo.png', data: PNG, alt: '  A cat  ' },
      { allowedTypes: ['image/*'], maxUploadBytes: 1000, typeLimits: {} },
      new Date('2026-10-29T12:00:00Z'),
      'abcde'
    )
    expect(upload).toMatchObject({
      fileName: 'photo-abcde.png',
      name: 'Photo.png',
      mimeType: 'image/png',
      size: PNG.length,
      width: 10,
      height: 20,
      alt: 'A cat',
      createdAt: '2026-10-29T12:00:00.000Z',
    })
  })

  it('uses the bytes, not the name: an SVG named .png is refused (415)', async () => {
    const { prepareMediaUpload } = await import('../server/utils/pluto-media')
    const svg = new TextEncoder().encode('<svg onload="alert(1)"/>')
    expect(() =>
      prepareMediaUpload(
        { name: 'x.png', data: svg },
        resolveMediaLimits(undefined)
      )
    ).toThrowError(expect.objectContaining({ statusCode: 415 }))
  })

  it('refuses a type that the app does not allow, a large file and an empty file', async () => {
    const { prepareMediaUpload } = await import('../server/utils/pluto-media')
    const model = new TextEncoder().encode('glTF\x02\0\0\0')
    expect(() =>
      prepareMediaUpload(
        { name: 'm.glb', data: model },
        { allowedTypes: ['image/*'], maxUploadBytes: 1000, typeLimits: {} }
      )
    ).toThrowError(expect.objectContaining({ statusCode: 415 }))
    expect(() =>
      prepareMediaUpload(
        { name: 'p.png', data: PNG },
        { allowedTypes: ['image/*'], maxUploadBytes: 10, typeLimits: {} }
      )
    ).toThrowError(expect.objectContaining({ statusCode: 413 }))
    expect(() =>
      prepareMediaUpload(
        { name: 'p.png', data: new Uint8Array() },
        resolveMediaLimits(undefined)
      )
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('keeps a model with its real type and no pixel size', async () => {
    const { prepareMediaUpload } = await import('../server/utils/pluto-media')
    const model = new TextEncoder().encode('glTF\x02\0\0\0')
    const upload = prepareMediaUpload(
      { name: 'Mug.glb', data: model },
      resolveMediaLimits({ extraTypes: ['model/gltf-binary'] })
    )
    expect(upload).toMatchObject({
      mimeType: 'model/gltf-binary',
      width: null,
      height: null,
    })
    expect(upload.fileName).toMatch(/^mug-[a-z0-9]{5}\.glb$/)
  })
})

describe('type limits and previews', () => {
  const model = new TextEncoder().encode(`glTF\x02\0\0\0${  'x'.repeat(40)}`)

  it('a type limit wins over maxUploadBytes, in both directions', async () => {
    const { prepareMediaUpload } = await import('../server/utils/pluto-media')
    const limits = resolveMediaLimits({
      extraTypes: ['model/gltf-binary'],
      maxUploadBytes: 10,
      typeLimits: { 'model/gltf-binary': 100 },
    })
    expect(
      prepareMediaUpload({ name: 'm.glb', data: model }, limits).mimeType
    ).toBe('model/gltf-binary')
    expect(() =>
      prepareMediaUpload({ name: 'p.png', data: PNG }, limits)
    ).toThrowError(expect.objectContaining({ statusCode: 413 }))
    const small = resolveMediaLimits({
      extraTypes: ['model/gltf-binary'],
      maxUploadBytes: 1000,
      typeLimits: { 'model/gltf-binary': 10 },
    })
    expect(() =>
      prepareMediaUpload({ name: 'm.glb', data: model }, small)
    ).toThrowError(expect.objectContaining({ statusCode: 413 }))
  })

  it('an upload with a preview: the preview is checked and named after the file', async () => {
    const { prepareMediaUpload } = await import('../server/utils/pluto-media')
    const limits = resolveMediaLimits({ extraTypes: ['model/gltf-binary'] })
    const upload = prepareMediaUpload(
      { name: 'Mug.glb', data: model, preview: PNG },
      limits,
      new Date(),
      'abcde'
    )
    expect(upload.preview).toMatchObject({
      fileName: 'mug-abcde.preview.png',
      mimeType: 'image/png',
      width: 10,
      height: 20,
    })
  })

  it('a preview that is not a JPEG, PNG or WebP image is refused (415)', async () => {
    const { prepareMediaPreview } = await import('../server/utils/pluto-media')
    expect(() => prepareMediaPreview(model, 'm.glb')).toThrowError(
      expect.objectContaining({ statusCode: 415 })
    )
    expect(() =>
      prepareMediaPreview(new TextEncoder().encode('<svg/>'), 'm.glb')
    ).toThrowError(expect.objectContaining({ statusCode: 415 }))
  })
})

describe('the public API expands media fields', () => {
  const productType: PlutoContentType = {
    name: 'product',
    label: 'Product',
    labelPlural: 'Products',
    source: 'products',
    titleField: 'name',
    fields: [
      { name: 'name', type: 'text', label: 'Name' },
      { name: 'cover', type: 'media', label: 'Cover' },
      { name: 'gallery', type: 'media', label: 'Gallery', multiple: true },
    ],
    api: { public: true },
  }

  const rows: PlutoContentItem[] = [
    { id: 1, name: 'Mug', cover: 'a', gallery: ['bb', 'gone', 'a'] },
    { id: 2, name: 'Cup', cover: 'gone', gallery: [] },
  ]

  async function setup() {
    const content = await import('../server/utils/pluto-content')
    const mediaModule = await import('../server/utils/pluto-media-driver')
    const adapter: PlutoContentAdapter = {
      id: 'memory',
      list: async () => ({ data: rows, total: rows.length }),
      get: async () => null,
      create: async () => rows[0]!,
      update: async () => rows[0]!,
      remove: async () => {},
    }
    content.registerContentType(productType)
    content.registerContentAdapter(adapter)
    const get = vi.fn(async (_event: H3Event, ids: string[]) =>
      ids.filter((id) => id !== 'gone').map((id) => media(id))
    )
    const driver = { name: 'memory', get } as unknown as PlutoMediaDriver
    mediaModule.registerMediaDriver(driver)
    return { get, api: await import('../server/utils/pluto-public-api') }
  }

  it('puts the records in place of the ids, with one driver call for the whole list', async () => {
    const { get, api } = await setup()
    const result = await api.listPublicContent(event(), 'product', {})
    expect(get).toHaveBeenCalledTimes(1)
    expect([...(get.mock.calls[0]?.[1] ?? [])].sort()).toEqual([
      'a',
      'bb',
      'gone',
    ])
    expect(result.data[0]).toMatchObject({
      cover: { id: 'a', url: '/media/a.webp', width: 100 },
      gallery: [{ id: 'bb' }, { id: 'a' }],
    })
  })

  it('drops an id with no record: one field gives null, a list leaves it out', async () => {
    const { api } = await setup()
    const result = await api.listPublicContent(event(), 'product', {})
    expect(result.data[1]).toMatchObject({ cover: null, gallery: [] })
  })
})
