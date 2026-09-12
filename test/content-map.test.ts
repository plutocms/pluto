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
