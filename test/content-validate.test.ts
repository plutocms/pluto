import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { validateContentPayload } from '../shared/utils/content-validate'

const type: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text', label: 'Title', required: true, maxLength: 10 },
    { name: 'count', type: 'number', label: 'Count', integer: true, min: 1, max: 5 },
    { name: 'active', type: 'boolean', label: 'Active' },
    {
      name: 'kind',
      type: 'select',
      label: 'Kind',
      options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
    },
    { name: 'publishedAt', type: 'date', label: 'Published at' },
  ],
}

const validPayload = {
  title: 'Hello',
  count: 3,
  active: true,
  kind: 'a',
  publishedAt: '2026-01-01',
}

describe('validateContentPayload', () => {
  it('returns an empty array for a fully valid payload', () => {
    expect(validateContentPayload(type, validPayload)).toEqual([])
  })

  it('fails when a required field is missing', () => {
    const { title, ...rest } = validPayload
    const errors = validateContentPayload(type, rest)

    expect(errors).toContainEqual(expect.objectContaining({ field: 'title' }))
  })

  it('fails when a required field is present but empty', () => {
    const errors = validateContentPayload(type, { ...validPayload, title: '' })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'title' }))
  })

  it('passes when a required field is omitted from a partial payload', () => {
    const { title, ...rest } = validPayload
    const errors = validateContentPayload(type, rest, { partial: true })

    expect(errors).toEqual([])
  })

  it('fails when a number field holds a non-numeric value', () => {
    const errors = validateContentPayload(type, { ...validPayload, count: 'not-a-number' })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'count' }))
  })

  it('accepts a numeric string for a number field', () => {
    const errors = validateContentPayload(type, { ...validPayload, count: '3' })

    expect(errors).toEqual([])
  })

  it('fails when integer:true holds a fractional number', () => {
    const errors = validateContentPayload(type, { ...validPayload, count: 1.5 })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'count' }))
  })

  it('fails when a number is below min', () => {
    const errors = validateContentPayload(type, { ...validPayload, count: 0 })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'count' }))
  })

  it('fails when a number is above max', () => {
    const errors = validateContentPayload(type, { ...validPayload, count: 6 })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'count' }))
  })

  it('fails when a boolean field holds a non-boolean value', () => {
    const errors = validateContentPayload(type, { ...validPayload, active: 'yes' })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'active' }))
  })

  it('fails when a select field value is not one of the options', () => {
    const errors = validateContentPayload(type, { ...validPayload, kind: 'z' })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'kind' }))
  })

  it('fails when a text field exceeds maxLength', () => {
    const errors = validateContentPayload(type, { ...validPayload, title: 'way too long a title' })

    expect(errors).toContainEqual(expect.objectContaining({ field: 'title' }))
  })
})
