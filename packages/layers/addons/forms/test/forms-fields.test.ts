import { describe, expect, it } from 'vitest'
import { parsePlutoBlocks } from '../../../../core/server/utils/pluto-blocks'
import {
  plutoFormFields,
  plutoFormNameFromLabel,
  plutoFormOptions,
} from '../shared/utils/forms-fields'

function node(name: string, props: Record<string, unknown> = {}) {
  return [name, props]
}

describe('plutoFormNameFromLabel', () => {
  it('makes a key from a label', () => {
    expect(plutoFormNameFromLabel('Your e-mail')).toBe('your_e_mail')
    expect(plutoFormNameFromLabel('Endereço')).toBe('endereco')
  })

  it('gives nothing for a label with no letter at the start', () => {
    expect(plutoFormNameFromLabel('123')).toBe('')
    expect(plutoFormNameFromLabel('')).toBe('')
  })
})

describe('plutoFormOptions', () => {
  it('splits on semicolons and new lines', () => {
    expect(plutoFormOptions('Sales; Support\nOther')).toEqual([
      { value: 'Sales', label: 'Sales' },
      { value: 'Support', label: 'Support' },
      { value: 'Other', label: 'Other' },
    ])
  })

  it('reads value|Label and drops empty and repeated options', () => {
    expect(plutoFormOptions('s|Sales; ; s|Again; t|Tech')).toEqual([
      { value: 's', label: 'Sales' },
      { value: 't', label: 'Tech' },
    ])
  })
})

describe('plutoFormFields', () => {
  it('turns the field blocks into fields in order', () => {
    const { fields, submitLabel } = plutoFormFields({
      nodes: [
        node('form-input', { label: 'Name', required: true }),
        node('form-input', { label: 'Email', type: 'email', width: 'half' }),
        node('form-textarea', { label: 'Message', maxLength: '300', rows: 3 }),
        node('form-select', { label: 'Subject', options: 'a|Alpha; b|Beta' }),
        node('form-radio', { label: 'Plan', options: 'Basic; Pro' }),
        node('form-checkbox', { label: 'News' }),
        node('form-consent', { label: 'I agree', link: '/privacy' }),
        node('form-hidden', { name: 'source', value: 'web' }),
        node('form-submit', { label: 'Go' }),
      ],
    })

    expect(submitLabel).toBe('Go')
    expect(fields.map((field) => [field.name, field.type])).toEqual([
      ['name', 'text'],
      ['email', 'email'],
      ['message', 'textarea'],
      ['subject', 'select'],
      ['plan', 'radio'],
      ['news', 'checkbox'],
      ['i_agree', 'consent'],
      ['source', 'hidden'],
    ])
    expect(fields[0]).toMatchObject({ required: true, label: 'Name' })
    expect(fields[1]).toMatchObject({ width: 'half' })
    expect(fields[2]).toMatchObject({ maxLength: 300, rows: 3 })
    expect(fields[3]?.options).toEqual([
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ])
    expect(fields[6]).toMatchObject({ required: true, link: '/privacy' })
    expect(fields[7]).toMatchObject({ value: 'web' })
  })

  it('makes a consent field required unless the block says no', () => {
    const { fields } = plutoFormFields({
      nodes: [
        node('form-consent', { label: 'A' }),
        node('form-consent', { label: 'B', required: false }),
      ],
    })

    expect(fields.map((field) => field.required)).toEqual([true, false])
  })

  it('keeps names unique and uses a given valid name', () => {
    const { fields } = plutoFormFields({
      nodes: [
        node('form-input', { label: 'Name' }),
        node('form-input', { label: 'Name' }),
        node('form-input', { label: 'X', name: 'custom_key' }),
        node('form-input', { label: 'X', name: 'Bad Key!' }),
        node('form-input', {}),
      ],
    })

    expect(fields.map((field) => field.name)).toEqual([
      'name',
      'name_2',
      'custom_key',
      'x',
      'field_5',
    ])
  })

  it('reads kebab case and colon props, and a bad input type is text', () => {
    const { fields } = plutoFormFields({
      nodes: [
        node('form-input', {
          'label': 'A',
          'type': 'password',
          'min-length': '2',
          ':max-length': 9,
        }),
      ],
    })

    expect(fields[0]).toMatchObject({ type: 'text', minLength: 2, maxLength: 9 })
  })

  it('skips other blocks and gives a default button label', () => {
    const result = plutoFormFields({
      nodes: [node('paragraph'), node('form-input', { label: 'A' }), 'text'],
    })

    expect(result.fields).toHaveLength(1)
    expect(result.submitLabel).toBe('Send')
    expect(plutoFormFields(null).fields).toEqual([])
  })

  it('reads a custom field block with its extra props', () => {
    const { fields } = plutoFormFields(
      { nodes: [node('form-rating', { label: 'Score', stars: 5, required: true })] },
      { custom: { 'form-rating': 'rating' } }
    )

    expect(fields[0]).toMatchObject({
      name: 'score',
      type: 'rating',
      required: true,
      props: { stars: 5 },
    })
  })

  it('reads the blocks that the real parser makes from a body', async () => {
    const document = await parsePlutoBlocks(
      [
        '::form-input{label="Name" required}',
        '::',
        '',
        '::form-select{label="Subject" options="Sales; Support"}',
        '::',
        '',
        '::form-submit{label="Send now"}',
        '::',
      ].join('\n')
    )
    const { fields, submitLabel } = plutoFormFields(document)

    expect(submitLabel).toBe('Send now')
    expect(fields).toHaveLength(2)
    expect(fields[0]).toMatchObject({ name: 'name', required: true })
    expect(fields[1]?.options).toHaveLength(2)
  })
})
