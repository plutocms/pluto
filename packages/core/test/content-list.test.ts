import type { PlutoContentType, PlutoField } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_LIST_SEARCH_MAX,
  adminListQueryKeys,
  formatListValue,
  isListSortField,
  isNarrowedListQuery,
  listFilterFields,
  parseAdminListQuery,
} from '../shared/utils/content-list'

const plain: PlutoField = { name: 'title', type: 'text', label: 'Title' }

describe('formatListValue', () => {
  it('shows a raw value as text when the field has no formatter', () => {
    expect(formatListValue(plain, { id: 1, title: 'Hello' })).toBe('Hello')
    expect(formatListValue({ ...plain, name: 'n' }, { id: 1, n: 5 })).toBe('5')
  })

  it('shows an empty string for an empty value', () => {
    expect(formatListValue(plain, { id: 1 })).toBe('')
    expect(formatListValue(plain, { id: 1, title: null })).toBe('')
  })

  it('shows an object as JSON', () => {
    expect(formatListValue(plain, { id: 1, title: { a: 1 } })).toBe('{"a":1}')
  })

  it('uses listFormat with the value and the item', () => {
    const price: PlutoField = {
      name: 'price',
      type: 'number',
      label: 'Price',
      listFormat: (value, item) =>
        `${item.currency} ${((value as number) / 100).toFixed(2)}`,
    }
    expect(formatListValue(price, { id: 1, price: 4990, currency: 'R$' })).toBe(
      'R$ 49.90'
    )
  })

  it('turns a nullish formatter result into an empty string', () => {
    const field = { ...plain, listFormat: () => undefined as unknown as string }
    expect(formatListValue(field, { id: 1, title: 'x' })).toBe('')
  })

  it('falls back to the raw value when the formatter throws', () => {
    const field: PlutoField = {
      ...plain,
      listFormat: () => {
        throw new Error('bad')
      },
    }
    expect(formatListValue(field, { id: 1, title: 'Hello' })).toBe('Hello')
  })
})

describe('the admin list query', () => {
  const postType = {
    name: 'post',
    label: 'Post',
    labelPlural: 'Posts',
    source: 'posts',
    titleField: 'title',
    status: {
      values: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
      ],
      default: 'draft',
    },
    fields: [
      { name: 'title', type: 'text', label: 'Title', inList: true },
      { name: 'body', type: 'richtext', label: 'Body', inList: true },
      { name: 'views', type: 'number', label: 'Views', inList: true },
      { name: 'hidden', type: 'number', label: 'Hidden' },
      {
        name: 'kind',
        type: 'select',
        label: 'Kind',
        inList: true,
        options: [
          { label: 'News', value: 'news' },
          { label: 'Two', value: 2 },
        ],
      },
      {
        name: 'featured',
        type: 'boolean',
        label: 'Featured',
        order: 5,
        filter: true,
      },
      { name: 'noindex', type: 'boolean', label: 'Hide' },
      {
        name: 'tags',
        type: 'reference',
        label: 'Tags',
        target: 'tag',
        multiple: true,
      },
      { name: 'legacy', type: 'reference', label: 'Legacy' },
      {
        name: 'quiet',
        type: 'select',
        label: 'Quiet',
        options: [{ label: 'A', value: 'a' }],
        filter: false,
      },
      {
        name: 'code',
        type: 'text',
        label: 'Code',
        inList: true,
        sortable: false,
      },
    ],
  } as unknown as PlutoContentType

  it('offers target references, and select and boolean fields in the list or with filter: true, by order', () => {
    expect(listFilterFields(postType).map((field) => field.name)).toEqual([
      'featured',
      'kind',
      'tags',
    ])
  })

  it('sorts by list columns of a sortable type only', () => {
    const sortable = postType.fields
      .filter(isListSortField)
      .map((field) => field.name)
    expect(sortable).toEqual(['title', 'views', 'kind'])
  })

  it('reads every part and keeps the order of the keys', () => {
    const { query, invalid } = parseAdminListQuery(postType, {
      search: '  hello  ',
      status: 'draft',
      sort: '-views',
      'filter[kind]': '2',
      'filter[featured]': 'true',
      'filter[tags]': '7',
    })

    expect(invalid).toEqual([])
    expect(query).toEqual({
      search: 'hello',
      status: 'draft',
      sort: { field: 'views', direction: 'desc' },
      filters: { kind: '2', featured: 'true', tags: '7' },
    })
    expect(adminListQueryKeys(query)).toEqual({
      search: 'hello',
      status: 'draft',
      'filter[kind]': '2',
      'filter[featured]': 'true',
      'filter[tags]': '7',
      sort: '-views',
    })
    expect(isNarrowedListQuery(query)).toBe(true)
  })

  it('lists each value that the type does not allow', () => {
    const { query, invalid } = parseAdminListQuery(postType, {
      status: 'archived',
      sort: 'body',
      'filter[kind]': 'other',
      'filter[featured]': 'yes',
      'filter[legacy]': '1',
      'filter[quiet]': 'a',
      'filter[nope]': 'x',
    })

    expect(invalid).toEqual([
      'status',
      'sort',
      'filter[kind]',
      'filter[featured]',
      'filter[legacy]',
      'filter[quiet]',
      'filter[nope]',
    ])
    expect(query).toEqual({})
  })

  it('ignores empty values and cuts a long search', () => {
    const { query, invalid } = parseAdminListQuery(postType, {
      search: 'x'.repeat(ADMIN_LIST_SEARCH_MAX + 50),
      status: '',
      sort: '',
      'filter[kind]': '',
    })

    expect(invalid).toEqual([])
    expect(query.search).toHaveLength(ADMIN_LIST_SEARCH_MAX)
    expect(Object.keys(query)).toEqual(['search'])
  })

  it('accepts the scheduled and review values of a type that has them', () => {
    const scheduling = {
      ...postType,
      status: {
        ...postType.status,
        publishedAtColumn: 'publishedAt',
        schedule: true,
        review: true,
      },
    }
    expect(
      parseAdminListQuery(scheduling, { status: 'scheduled' }).query
    ).toMatchObject({ status: 'scheduled' })
    expect(
      parseAdminListQuery(scheduling, { status: 'review' }).query
    ).toMatchObject({ status: 'review' })
    expect(
      parseAdminListQuery(postType, { status: 'scheduled' }).invalid
    ).toEqual(['status'])
  })

  it('has no status filter for a type with no workflow', () => {
    const plainType = { ...postType, status: undefined }
    expect(parseAdminListQuery(plainType, { status: 'draft' }).invalid).toEqual(
      ['status']
    )
  })

  it('counts a sort alone as no narrowing', () => {
    expect(
      isNarrowedListQuery({ sort: { field: 'title', direction: 'asc' } })
    ).toBe(false)
    expect(isNarrowedListQuery({ filters: {} })).toBe(false)
  })
})
