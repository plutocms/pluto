import type { PlutoContentType, PlutoField } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { fieldColumn, mapColumnsToFields, mapFieldsToColumns } from '../shared/utils/content-map'

const type: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  primaryKey: 'post_id',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'body', type: 'richtext', label: 'Body', column: 'body_html' },
  ],
}

describe('fieldColumn', () => {
  it('falls back to field.name when field.column is unset', () => {
    const field: PlutoField = { name: 'title', type: 'text', label: 'Title' }
    expect(fieldColumn(field)).toBe('title')
  })

  it('uses field.column when set', () => {
    const field: PlutoField = { name: 'body', type: 'richtext', label: 'Body', column: 'body_html' }
    expect(fieldColumn(field)).toBe('body_html')
  })
})

describe('mapFieldsToColumns / mapColumnsToFields', () => {
  it('round-trips a payload through a field list with a renamed column', () => {
    const payload = { title: 'Hello', body: '<p>Hi</p>' }

    const columns = mapFieldsToColumns(type, payload)
    expect(columns).toEqual({ title: 'Hello', body_html: '<p>Hi</p>' })

    const row = { post_id: 42, ...columns }
    const item = mapColumnsToFields(type, row)
    expect(item).toEqual({ id: 42, title: 'Hello', body: '<p>Hi</p>' })
  })

  it('maps the primary key column to item.id', () => {
    const row = { post_id: 7, title: 'Hello', body_html: '<p>Hi</p>' }
    const item = mapColumnsToFields(type, row)

    expect(item.id).toBe(7)
  })

  it('leaves a field out of mapFieldsToColumns when it is absent from the payload', () => {
    const columns = mapFieldsToColumns(type, { title: 'Hello' })

    expect(columns).toEqual({ title: 'Hello' })
    expect(columns).not.toHaveProperty('body_html')
  })
})

describe('virtual fields', () => {
  const typeWithVirtual: PlutoContentType = {
    ...type,
    fields: [
      ...type.fields,
      { name: 'media', type: 'text', label: 'Media', virtual: true },
    ],
  }

  it('mapFieldsToColumns never includes a virtual field, even when the payload has a value for it', () => {
    const columns = mapFieldsToColumns(typeWithVirtual, {
      title: 'Hello',
      body: '<p>Hi</p>',
      media: ['a.png'],
    })

    expect(columns).toEqual({ title: 'Hello', body_html: '<p>Hi</p>' })
    expect(columns).not.toHaveProperty('media')
  })

  it('mapColumnsToFields never includes a virtual field, even when the row has a matching column', () => {
    const row = { post_id: 42, title: 'Hello', body_html: '<p>Hi</p>', media: ['a.png'] }
    const item = mapColumnsToFields(typeWithVirtual, row)

    expect(item).toEqual({ id: 42, title: 'Hello', body: '<p>Hi</p>' })
    expect(item).not.toHaveProperty('media')
  })
})

describe('mapColumnsToFields status symmetry', () => {
  const typeWithStatus: PlutoContentType = {
    ...type,
    status: {
      values: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      publishedValue: 'published',
    },
  }

  it('maps the status column to item.status when type.status is set', () => {
    const row = { post_id: 42, title: 'Hello', body_html: '<p>Hi</p>', status: 'published' }
    const item = mapColumnsToFields(typeWithStatus, row)

    expect(item.status).toBe('published')
  })

  it('uses a custom status column name when type.status.column is set', () => {
    const typeWithCustomColumn: PlutoContentType = {
      ...type,
      status: {
        column: 'workflow_state',
        values: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
        ],
        publishedValue: 'published',
      },
    }
    const row = { post_id: 42, title: 'Hello', body_html: '<p>Hi</p>', workflow_state: 'draft' }
    const item = mapColumnsToFields(typeWithCustomColumn, row)

    expect(item.status).toBe('draft')
  })

  it('leaves status out of the mapped result when type.status is unset', () => {
    const row = { post_id: 42, title: 'Hello', body_html: '<p>Hi</p>', status: 'published' }
    const item = mapColumnsToFields(type, row)

    expect(item).not.toHaveProperty('status')
  })

  it('does not overwrite a declared field named status with the workflow fallback', () => {
    const typeWithStatusField: PlutoContentType = {
      ...typeWithStatus,
      fields: [
        ...type.fields,
        { name: 'status', type: 'text', label: 'Status', column: 'custom_status' },
      ],
    }
    const row = { post_id: 42, title: 'Hello', body_html: '<p>Hi</p>', custom_status: 'from-field', status: 'from-workflow' }
    const item = mapColumnsToFields(typeWithStatusField, row)

    expect(item.status).toBe('from-field')
  })
})
