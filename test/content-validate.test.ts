import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { validateContentPayload } from '../shared/utils/content-validate'
import { createI18nStub } from './fixtures/i18n-stub'

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

  it('still validates a required virtual field, even though it has no storage column', () => {
    const typeWithVirtual: PlutoContentType = {
      ...type,
      fields: [
        ...type.fields,
        { name: 'media', type: 'text', label: 'Media', required: true, virtual: true },
      ],
    }

    const errors = validateContentPayload(typeWithVirtual, validPayload)

    expect(errors).toContainEqual(expect.objectContaining({ field: 'media' }))
  })
})

describe('validateContentPayload — code and params', () => {
  const find = (payload: Record<string, unknown>, field: string) =>
    validateContentPayload(type, payload).find((error) => error.field === field)

  it('gives the code "required" with no params', () => {
    expect(find({ ...validPayload, title: '' }, 'title')).toEqual({
      field: 'title',
      message: '"Title" is required.',
      code: 'required',
    })
  })

  it('gives the code "number" for a value that is not a number', () => {
    expect(find({ ...validPayload, count: 'abc' }, 'count')).toMatchObject({ message: '"Count" must be a number.', code: 'number' })
  })

  it('gives the code "integer"', () => {
    expect(find({ ...validPayload, count: 2.5 }, 'count')).toMatchObject({ message: '"Count" must be an integer.', code: 'integer' })
  })

  it('gives the code "min" with the min param', () => {
    expect(find({ ...validPayload, count: 0 }, 'count')).toMatchObject({
      message: '"Count" must be at least 1.',
      code: 'min',
      params: { min: 1 },
    })
  })

  it('gives the code "max" with the max param', () => {
    expect(find({ ...validPayload, count: 9 }, 'count')).toMatchObject({
      message: '"Count" must be at most 5.',
      code: 'max',
      params: { max: 5 },
    })
  })

  it('gives the code "boolean"', () => {
    expect(find({ ...validPayload, active: 'yes' }, 'active')).toMatchObject({ message: '"Active" must be a boolean.', code: 'boolean' })
  })

  it('gives the code "option"', () => {
    expect(find({ ...validPayload, kind: 'z' }, 'kind')).toMatchObject({
      message: '"Kind" must be one of the allowed options.',
      code: 'option',
    })
  })

  it('gives the code "maxLength" with the max param', () => {
    expect(find({ ...validPayload, title: 'way too long a title' }, 'title')).toMatchObject({
      message: '"Title" must be at most 10 characters.',
      code: 'maxLength',
      params: { max: 10 },
    })
  })

  it('has an en message under pluto.validation.<code> that equals the English message', () => {
    const { t } = createI18nStub('en')
    const payloads = [
      { ...validPayload, title: '' },
      { ...validPayload, count: 'abc' },
      { ...validPayload, count: 2.5 },
      { ...validPayload, count: 0 },
      { ...validPayload, count: 9 },
      { ...validPayload, active: 'yes' },
      { ...validPayload, kind: 'z' },
      { ...validPayload, title: 'way too long a title' },
    ]
    const errors = payloads.flatMap((payload) => validateContentPayload(type, payload))
    const labels: Record<string, string> = { title: 'Title', count: 'Count', active: 'Active', kind: 'Kind' }

    expect(new Set(errors.map((error) => error.code)).size).toBe(8)
    for (const error of errors) {
      expect(t(`pluto.validation.${error.code}`, { ...error.params, label: labels[error.field] })).toBe(error.message)
    }
  })
})
