import type { PlutoFormDefinition } from '../shared/types/forms'
import { describe, expect, it } from 'vitest'
import { buildFormDefinition } from '../server/utils/forms-definitions'
import {
  definePlutoForm,
  definePlutoFormField,
  plutoFormCustomTypes,
  plutoFormRecipients,
  plutoFormSettings,
  plutoMergeForm,
  plutoPublicForm,
} from '../shared/utils/forms-define'

const code = definePlutoForm({
  handle: 'newsletter',
  title: 'Newsletter',
  fields: [{ name: 'email', type: 'email', label: 'Email', required: true }],
  settings: { recipients: ['team@example.com'], subject: 'New subscriber' },
})

describe('definePlutoForm', () => {
  it('fills the defaults', () => {
    expect(code).toMatchObject({
      handle: 'newsletter',
      submitLabel: 'Send',
      source: 'code',
      settings: {
        recipients: ['team@example.com'],
        subject: 'New subscriber',
        retentionDays: 180,
      },
    })
  })

  it('refuses a handle that is not safe', () => {
    for (const handle of ['', 'A', 'a b', '../x', 'a_b']) {
      expect(() => definePlutoForm({ handle, title: 'X', fields: [] })).toThrow()
    }
  })
})

describe('merging a code form with a form of the admin', () => {
  it('keeps the structure of the code and takes the texts of the item', () => {
    const merged = plutoMergeForm(code, {
      title: 'The newsletter',
      recipients: 'boss@example.com',
      successMessage: 'Welcome!',
      retentionDays: 30,
      body: '::form-input{label="Ignored"}\n::',
    })

    expect(merged.fields).toBe(code.fields)
    expect(merged.title).toBe('The newsletter')
    expect(merged.settings).toEqual({
      recipients: ['boss@example.com'],
      subject: 'New subscriber',
      successMessage: 'Welcome!',
      retentionDays: 30,
    })
    expect(merged.source).toBe('code')
  })

  it('keeps the code settings for an empty or bad value of the item', () => {
    const merged = plutoMergeForm(code, {
      title: '',
      recipients: 'not an email',
      subject: '  ',
      retentionDays: 'x',
    })

    expect(merged.title).toBe('Newsletter')
    expect(merged.settings.recipients).toEqual(['team@example.com'])
    expect(merged.settings.subject).toBe('New subscriber')
    expect(merged.settings.retentionDays).toBe(180)
  })

  it('is the code form when there is no item', () => {
    expect(plutoMergeForm(code, null)).toBe(code)
  })

  it('builds a form from an item and its blocks when there is no code', () => {
    const built = buildFormDefinition({
      handle: 'contact',
      item: { title: 'Contact', recipients: 'a@b.co, c@d.co' },
      blocks: {
        nodes: [
          ['form-input', { label: 'Name' }],
          ['form-submit', { label: 'Go' }],
        ],
      },
    })

    expect(built).toMatchObject({
      handle: 'contact',
      source: 'content',
      submitLabel: 'Go',
      settings: { recipients: ['a@b.co', 'c@d.co'], retentionDays: 180 },
    })
    expect(built?.fields).toHaveLength(1)
  })

  it('prefers the code form over the blocks of an item with the same handle', () => {
    const built = buildFormDefinition({
      handle: 'newsletter',
      code,
      item: { title: 'X' },
      blocks: { nodes: [['form-input', { label: 'Other' }]] },
    }) as PlutoFormDefinition

    expect(built.fields).toBe(code.fields)
  })

  it('has no form when there is neither', () => {
    expect(buildFormDefinition({ handle: 'none' })).toBeNull()
  })
})

describe('settings and recipients', () => {
  it('keeps valid addresses once, up to ten', () => {
    expect(plutoFormRecipients('A@b.co; a@B.co, bad, c@d.co')).toEqual(['a@B.co', 'c@d.co'])
    expect(
      plutoFormRecipients(Array.from({ length: 20 }, (_, index) => `u${index}@x.co`))
    ).toHaveLength(10)
    expect(plutoFormRecipients(5)).toEqual([])
  })

  it('limits the retention', () => {
    expect(plutoFormSettings({ retentionDays: 99999 }).retentionDays).toBe(3650)
    expect(plutoFormSettings({ retentionDays: -5 }).retentionDays).toBe(0)
    expect(plutoFormSettings({ retentionDays: '' }).retentionDays).toBe(180)
  })
})

describe('definePlutoFormField', () => {
  it('maps the blocks and the validators of the custom types', () => {
    const validate = () => 'bad'
    const rating = definePlutoFormField({
      name: 'rating',
      block: 'form-rating',
      validate,
      component: 'MyRating',
    })

    expect(plutoFormCustomTypes([rating])).toEqual({
      blocks: { 'form-rating': 'rating' },
      validators: { rating: validate },
    })
    expect(plutoFormCustomTypes()).toEqual({ blocks: {}, validators: {} })
  })
})

describe('plutoPublicForm', () => {
  it('has the title, the handle, the fields and the success message only', () => {
    const form = plutoMergeForm(code, { successMessage: 'Welcome!' })

    expect(Object.keys(plutoPublicForm(form)).sort()).toEqual([
      'fields',
      'handle',
      'submitLabel',
      'successMessage',
      'title',
    ])
    expect(JSON.stringify(plutoPublicForm(form))).not.toContain('team@example.com')
  })
})
