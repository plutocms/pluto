import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plutoFormErrorMessage } from '../shared/utils/forms-errors'

describe('plutoFormErrorMessage', () => {
  it('gives a consent field its own required message', () => {
    const field = { name: 'c', type: 'consent', label: 'I agree' }

    expect(plutoFormErrorMessage(field, 'required').key).toBe(
      'forms.errors.consentRequired'
    )
  })

  it('keeps the normal message for the other fields and codes', () => {
    const text = { name: 't', type: 'text', label: 'Name' }

    expect(plutoFormErrorMessage(text, 'required').key).toBe('forms.errors.required')
    expect(
      plutoFormErrorMessage({ ...text, type: 'consent' }, 'invalid').key
    ).toBe('forms.errors.invalid')
  })
})

describe('the form styles', () => {
  it('define the variables on :root, so a field block works with no .pluto-form parent', () => {
    const css = readFileSync(
      join(__dirname, '../app/assets/css/forms.css'),
      'utf8'
    )

    expect(css).toMatch(/:where\(:root\)\s*\{\s*--pluto-form-gap/)
  })
})
