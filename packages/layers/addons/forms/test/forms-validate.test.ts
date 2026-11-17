import type { PlutoFormField } from '../shared/types/forms'
import { describe, expect, it } from 'vitest'
import { plutoValidateForm } from '../shared/utils/forms-validate'

function check(field: PlutoFormField, value: unknown, options = {}) {
  return plutoValidateForm([field], { [field.name]: value }, options)
}

const text = (extra: Partial<PlutoFormField> = {}): PlutoFormField => ({
  name: 'f',
  type: 'text',
  label: 'F',
  ...extra,
})

describe('plutoValidateForm', () => {
  it('needs an object', () => {
    expect(plutoValidateForm([], null).errors).toEqual({ _form: 'invalid' })
    expect(plutoValidateForm([], []).errors).toEqual({ _form: 'invalid' })
  })

  it('refuses a key that is not a field', () => {
    const result = plutoValidateForm([text()], { f: 'a', extra: 'b' })

    expect(result.errors).toEqual({ extra: 'unknown' })
    expect(result.values).toEqual({})
  })

  it('checks required', () => {
    expect(check(text({ required: true }), '').errors.f).toBe('required')
    expect(check(text({ required: true }), '   ').errors.f).toBe('required')
    expect(check(text({ required: true }), undefined).errors.f).toBe('required')
    expect(check(text(), '').errors).toEqual({})
    expect(check(text(), '').values).toEqual({ f: '' })
  })

  it('trims a text and checks the length', () => {
    expect(check(text(), '  hi ').values.f).toBe('hi')
    expect(check(text({ minLength: 3 }), 'ab').errors.f).toBe('tooShort')
    expect(check(text({ maxLength: 3 }), 'abcd').errors.f).toBe('tooLong')
    expect(check(text(), 'a'.repeat(501)).errors.f).toBe('tooLong')
    expect(check({ ...text(), type: 'textarea' }, 'a'.repeat(501)).errors).toEqual({})
    expect(
      check({ ...text(), type: 'textarea', maxLength: 99999 }, 'a'.repeat(5001))
        .errors.f
    ).toBe('tooLong')
  })

  it('matches a pattern against the whole value', () => {
    const field = text({ pattern: '[A-Z]{2}\\d+' })

    expect(check(field, 'AB12').errors).toEqual({})
    expect(check(field, 'AB12x').errors.f).toBe('invalid')
    expect(check(text({ pattern: '(' }), 'x').errors).toEqual({})
  })

  it('refuses a list or an object', () => {
    expect(check(text(), ['a']).errors.f).toBe('invalid')
    expect(check(text(), { a: 1 }).errors.f).toBe('invalid')
  })

  it('checks an email', () => {
    const field = text({ type: 'email' })

    expect(check(field, 'a@b.co').errors).toEqual({})
    expect(check(field, 'a@b').errors.f).toBe('invalid')
    expect(check(field, 'a b@c.com').errors.f).toBe('invalid')
    expect(check(field, 'a@b.com, c@d.com').errors.f).toBe('invalid')
    expect(check(field, 'a@b.com\r\nBcc: x@y.com').errors.f).toBe('invalid')
  })

  it('checks a url, a phone and a date', () => {
    expect(check(text({ type: 'url' }), 'https://a.co/x').errors).toEqual({})
    expect(check(text({ type: 'url' }), 'javascript:alert(1)').errors.f).toBe(
      'invalid'
    )
    expect(check(text({ type: 'tel' }), '+55 (11) 99999-0000').errors).toEqual({})
    expect(check(text({ type: 'tel' }), 'call me').errors.f).toBe('invalid')
    expect(check(text({ type: 'date' }), '2026-02-28').errors).toEqual({})
    expect(check(text({ type: 'date' }), '2026-02-30').errors.f).toBe('invalid')
    expect(check(text({ type: 'date' }), '28/02/2026').errors.f).toBe('invalid')
  })

  it('checks a number with min and max', () => {
    const field = text({ type: 'number', min: 1, max: 10 })

    expect(check(field, '5').values.f).toBe(5)
    expect(check(field, 7).values.f).toBe(7)
    expect(check(field, '0').errors.f).toBe('tooSmall')
    expect(check(field, '11').errors.f).toBe('tooBig')
    expect(check(field, 'abc').errors.f).toBe('invalid')
  })

  it('accepts only an option of a select or a radio', () => {
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]

    for (const type of ['select', 'radio']) {
      expect(check(text({ type, options }), 'a').errors).toEqual({})
      expect(check(text({ type, options }), 'c').errors.f).toBe('option')
    }
  })

  it('reads a checkbox as a boolean and a consent as required', () => {
    const box = text({ type: 'checkbox' })
    const consent = text({ type: 'consent', required: true })

    expect(check(box, true).values.f).toBe(true)
    expect(check(box, 'on').values.f).toBe(true)
    expect(check(box, undefined).values.f).toBe(false)
    expect(check(box, 5).errors.f).toBe('invalid')
    expect(check(consent, false).errors.f).toBe('required')
    expect(check(consent, true).errors).toEqual({})
  })

  it('uses the value of a hidden field when none comes', () => {
    const hidden = text({ type: 'hidden', value: 'web' })

    expect(check(hidden, undefined).values.f).toBe('web')
    expect(check(hidden, 'ads').values.f).toBe('ads')
    expect(check(hidden, 'x'.repeat(501)).errors.f).toBe('tooLong')
  })

  it('runs the validator of a custom type', () => {
    const field = text({ type: 'rating' })
    const custom = {
      rating: (value: unknown) =>
        Number(value) >= 1 && Number(value) <= 5 ? undefined : 'Pick 1 to 5',
    }

    expect(check(field, '3', { custom }).errors).toEqual({})
    expect(check(field, '9', { custom }).errors.f).toBe('Pick 1 to 5')
    expect(check(text({ type: 'rating', required: true }), '', { custom }).errors.f).toBe('required')
  })

  it('gives the clean values of every field', () => {
    const result = plutoValidateForm(
      [text({ name: 'a' }), text({ name: 'b', type: 'number' })],
      { a: ' x ', b: '2' }
    )

    expect(result).toEqual({ values: { a: 'x', b: 2 }, errors: {} })
  })
})
