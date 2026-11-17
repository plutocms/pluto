import type { PlutoFormDefinition } from '../shared/types/forms'
import { describe, expect, it } from 'vitest'
import {
  escapeFormsHtml,
  formsHeaderText,
  formsReplyTo,
  renderFormsEmail,
} from '../server/utils/forms-mail'

const form: PlutoFormDefinition = {
  handle: 'contact',
  title: 'Contact',
  submitLabel: 'Send',
  source: 'content',
  fields: [
    { name: 'name', type: 'text', label: 'Name <b>' },
    { name: 'email', type: 'email', label: 'Email' },
    { name: 'news', type: 'checkbox', label: 'News' },
    { name: 'src', type: 'hidden', label: '', value: '' },
  ],
  settings: { recipients: ['a@b.co'], retentionDays: 180 },
}

describe('the email of a submission', () => {
  it('escapes every label and value in the HTML', () => {
    const email = renderFormsEmail({
      form,
      values: {
        name: '<script>alert(1)</script> & "x"',
        email: 'a@b.co',
        news: true,
        src: '',
      },
      siteName: 'My <Site>',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;')
    expect(email.html).toContain('Name &lt;b&gt;')
    expect(email.html).toContain('My &lt;Site&gt;')
    expect(email.text).toContain('News: Yes')
  })

  it('leaves an empty hidden field out', () => {
    const email = renderFormsEmail({
      form,
      values: { name: 'A', email: 'a@b.co', news: false, src: '' },
      createdAt: 'now',
    })

    expect(email.text).not.toContain('src')
  })

  it('makes the subject one safe line', () => {
    const email = renderFormsEmail({
      form: {
        ...form,
        settings: { ...form.settings, subject: 'Hi\r\nBcc: spy@evil.com' },
      },
      values: {},
      createdAt: 'now',
    })

    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(formsHeaderText('a'.repeat(300))).toHaveLength(150)
  })

  it('uses a default subject', () => {
    expect(renderFormsEmail({ form, values: {}, createdAt: 'now' }).subject).toBe(
      'New submission: Contact'
    )
  })

  it('takes the reply-to from the first valid email field only', () => {
    expect(formsReplyTo(form.fields, { email: 'ana@example.com' })).toBe('ana@example.com')
    expect(formsReplyTo(form.fields, { email: 'a@b.co, c@d.co' })).toBeUndefined()
    expect(formsReplyTo(form.fields, { email: 'a@b.co\r\nBcc: x@y.co' })).toBeUndefined()
    expect(formsReplyTo(form.fields, { email: '"Evil" <a@b.co>' })).toBeUndefined()
    expect(formsReplyTo(form.fields, {})).toBeUndefined()
  })

  it('escapes the five HTML characters', () => {
    expect(escapeFormsHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
