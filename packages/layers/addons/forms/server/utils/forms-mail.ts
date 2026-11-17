import type {
  PlutoFormDefinition,
  PlutoFormField,
  PlutoFormValues,
} from '../../shared/types/forms'

export interface PlutoFormsEmail {
  subject: string
  html: string
  text: string
  replyTo?: string
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}

const ADDRESS = /^[^\s@<>,;:"()[\]\\]+@[^\s"(),:;<>@[\\\]][^\s"(),.:;<>@[\\\]]*\.[^\s"(),:;<>@[\\\]]{2,}$/

export function escapeFormsHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)
}

function isControl(code: number): boolean {
  return code < 32 || code === 127 || code === 0x2028 || code === 0x2029
}

/** One line for a header: no control character, no line break, at most `max` characters. */
export function formsHeaderText(value: string, max = 150): string {
  return Array.from(value, (char) =>
    isControl(char.charCodeAt(0)) ? ' ' : char
  )
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max)
}

function show(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

/**
 * The Reply-To of the email: the value of the first `email` field that holds a plain address. It
 * is one address with no name, no comma and no line break, so a visitor cannot add a header or a
 * second recipient.
 */
export function formsReplyTo(
  fields: PlutoFormField[],
  values: PlutoFormValues
): string | undefined {
  for (const field of fields) {
    const value = values[field.name]
    if (
      field.type === 'email' &&
      typeof value === 'string' &&
      value.length <= 254 &&
      ADDRESS.test(value)
    ) {
      return value
    }
  }
  return undefined
}

/**
 * The email of one submission: a subject, an HTML table and a plain text. Every label and value
 * is escaped in the HTML, and the subject and the Reply-To are one safe line.
 */
export function renderFormsEmail(input: {
  form: PlutoFormDefinition
  values: PlutoFormValues
  siteName?: string
  createdAt: string
}): PlutoFormsEmail {
  const { form, values } = input
  const subject = formsHeaderText(
    form.settings.subject || `New submission: ${form.title}`
  )
  const rows = form.fields
    .filter((field) => field.type !== 'hidden' || show(values[field.name]))
    .map((field) => ({
      label: formsHeaderText(field.label || field.name, 200),
      value: show(values[field.name]),
    }))

  const site = input.siteName ? ` on ${input.siteName}` : ''
  const intro = `A visitor sent the form "${form.title}"${site}.`

  const html = [
    `<p>${escapeFormsHtml(intro)}</p>`,
    '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse">',
    ...rows.map(
      (row) =>
        `<tr><th align="left" valign="top" style="border-bottom:1px solid #ddd">${escapeFormsHtml(row.label)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${escapeFormsHtml(row.value)}</td></tr>`
    ),
    '</table>',
    `<p style="color:#666">${escapeFormsHtml(input.createdAt)}</p>`,
  ].join('\n')

  const text = [
    intro,
    '',
    ...rows.map((row) => `${row.label}: ${row.value}`),
    '',
    input.createdAt,
  ].join('\n')

  const replyTo = formsReplyTo(form.fields, values)
  return { subject, html, text, ...(replyTo && { replyTo }) }
}
