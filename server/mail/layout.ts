/**
 * The email layout: one 600 px table with inline CSS, a heading, text, an
 * optional button with a plain link under it, and a footer with the site
 * name. No image and no tracking pixel, so the email works without remote
 * content and leaves no trace of who opened it.
 *
 * Every text goes through `escapeHtml`. The plain text version has the same
 * content with no markup.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}

/** Escapes a text for HTML content and for a double-quoted or single-quoted attribute. */
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!)
}

/** Joins the words of a subject line on one line. A line break would split a header. */
export function toSubject(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Accepts only an absolute http or https URL. Anything else (for example `javascript:`) throws. */
export function assertHttpUrl(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new TypeError('The email link is not a valid URL.')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('The email link must use http or https.')
  }
  return parsed.toString()
}

export interface EmailLayoutInput {
  /** The language code of the email, for `<html lang>`. */
  lang: string
  siteName: string
  /** The page title and the heading. */
  heading: string
  /** Plain paragraphs. */
  paragraphs: string[]
  /** A call to action. `url` must be an http(s) URL. */
  button?: {
 label: string
url: string
}
  /** A sentence above the plain link under the button. Needs `button`. */
  linkHint?: string
  /** Small print under the button, for example "If you did not expect this email...". */
  notes?: string[]
  /** The footer line. It names the site. */
  footer: string
}

const FONT = '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif'
const TEXT_COLOR = '#1f2328'
const MUTED_COLOR = '#656d76'
const BUTTON_COLOR = '#2563eb'

/** Renders the HTML and the plain text of one email. */
export function renderEmailLayout(input: EmailLayoutInput): {
 html: string
text: string
} {
  const url = input.button ? assertHttpUrl(input.button.url) : undefined

  const paragraphs = input.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${TEXT_COLOR};">${escapeHtml(paragraph)}</p>`)
    .join('')

  const button = input.button && url
    ? [
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>`,
        `<td align="center" bgcolor="${BUTTON_COLOR}" style="border-radius:6px;background-color:${BUTTON_COLOR};">`,
        `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(input.button.label)}</a>`,
        `</td></tr></table>`,
        input.linkHint
          ? `<p style="margin:0 0 4px;font-size:14px;line-height:20px;color:${MUTED_COLOR};">${escapeHtml(input.linkHint)}</p>`
          : '',
        `<p style="margin:0 0 24px;font-size:14px;line-height:20px;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:${BUTTON_COLOR};">${escapeHtml(url)}</a></p>`,
      ].join('')
    : ''

  const notes = (input.notes ?? [])
    .map((note) => `<p style="margin:0 0 8px;font-size:14px;line-height:20px;color:${MUTED_COLOR};">${escapeHtml(note)}</p>`)
    .join('')

  const html = [
    '<!doctype html>',
    `<html lang="${escapeHtml(input.lang)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(input.heading)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background-color:#f6f8fa;font-family:${FONT};">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f8fa" style="background-color:#f6f8fa;"><tr><td align="center" style="padding:24px 12px;">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px;">`,
    `<tr><td style="padding:32px 32px 8px;font-family:${FONT};">`,
    `<h1 style="margin:0 0 24px;font-size:24px;line-height:32px;font-weight:700;color:${TEXT_COLOR};">${escapeHtml(input.heading)}</h1>`,
    paragraphs,
    button,
    notes,
    `</td></tr>`,
    `<tr><td style="padding:16px 32px 32px;font-family:${FONT};border-top:1px solid #d0d7de;">`,
    `<p style="margin:0;font-size:12px;line-height:18px;color:${MUTED_COLOR};">${escapeHtml(input.footer)}</p>`,
    `</td></tr>`,
    '</table>',
    '</td></tr></table>',
    '</body>',
    '</html>',
  ].join('')

  const textParts = [input.heading, '', ...input.paragraphs.flatMap((paragraph) => [paragraph, ''])]
  if (input.button && url) {
    textParts.push(`${input.button.label}:`, url, '')
  }
  for (const note of input.notes ?? []) {
    textParts.push(note, '')
  }
  textParts.push('--', input.footer)

  return { html, text: textParts.join('\n') }
}
