import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTranslator,
  flattenMessages,
} from '../app/composables/internal/i18n-core'
import {
  assertHttpUrl,
  escapeHtml,
  renderEmailLayout,
  toSubject,
} from '../server/mail/layout'
import { renderInviteEmail } from '../server/mail/templates/invite'
import { renderTestEmail } from '../server/mail/templates/test'

const messages = Object.fromEntries(
  ['en', 'pt-BR'].map((code) => [
    code,
    flattenMessages(
      JSON.parse(
        readFileSync(
          join(__dirname, '..', 'i18n', 'locales', `${code}.json`),
          'utf8'
        )
      )
    ),
  ])
)

function context(locale = 'en', siteName = 'Acme Shop') {
  const { t } = createTranslator({
    locale: () => locale,
    messages: (code) => messages[code],
  })
  return { t, locale, siteName }
}

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe('escapeHtml', () => {
  it('escapes the five HTML characters', () => {
    expect(escapeHtml('<a href="x" onclick=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    )
  })

  it('leaves plain text as it is', () => {
    expect(escapeHtml('Olá, mundo!')).toBe('Olá, mundo!')
  })
})

describe('toSubject', () => {
  it('puts a subject on one line', () => {
    expect(toSubject('Hi\r\nBcc: a@b.test\n  there ')).toBe(
      'Hi Bcc: a@b.test there'
    )
  })
})

describe('assertHttpUrl', () => {
  it('accepts http and https', () => {
    expect(assertHttpUrl('https://example.com/a?b=1')).toBe(
      'https://example.com/a?b=1'
    )
    expect(assertHttpUrl('http://localhost:3000/x')).toBe(
      'http://localhost:3000/x'
    )
  })

  it('rejects other schemes and bad URLs', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,x',
      'ftp://example.com',
      '/relative',
      'not a url',
      '',
    ]) {
      expect(() => assertHttpUrl(url)).toThrow(TypeError)
    }
  })
})

describe('renderEmailLayout', () => {
  const input = {
    lang: 'en',
    siteName: 'Shop',
    heading: 'Welcome',
    paragraphs: ['First paragraph.', 'Second paragraph.'],
    button: { label: 'Open', url: 'https://example.com/go?a=1&b=2' },
    linkHint: 'Copy this link:',
    notes: ['Ignore this if you did not ask.'],
    footer: 'Sent by Shop.',
  }

  it('is a 600 px table layout with inline CSS', () => {
    const { html } = renderEmailLayout(input)

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('width="600"')
    expect(html).toContain('max-width:600px')
    expect(html).toContain('role="presentation"')
    expect(html).not.toContain('<style')
    expect(html).not.toContain('<script')
  })

  it('has no image and no tracking', () => {
    const { html } = renderEmailLayout(input)

    expect(html).not.toMatch(/<img/i)
    expect(html).not.toMatch(/background-image|url\(/i)
    expect(html).not.toMatch(/<link|<iframe|<video|<audio/i)
  })

  it('has a button and the same link as plain text', () => {
    const { html } = renderEmailLayout(input)

    expect(
      html.match(/href="https:\/\/example\.com\/go\?a=1&amp;b=2"/g)
    ).toHaveLength(2)
    expect(html).toContain('>Open</a>')
    expect(html).toContain('Copy this link:')
  })

  it('has the footer', () => {
    expect(renderEmailLayout(input).html).toContain('Sent by Shop.')
  })

  it('escapes every text', () => {
    const { html } = renderEmailLayout({
      ...input,
      lang: 'en"><script>',
      heading: '<b>Hi</b>',
      paragraphs: ['<script>alert(1)</script>'],
      button: {
        label: '"><img src=x>',
        url: 'https://example.com/?q="><script>',
      },
      notes: ['<i>note</i>'],
      footer: 'Sent by <Shop> & Co.',
    })

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<i>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Sent by &lt;Shop&gt; &amp; Co.')
  })

  it('refuses a button URL that is not http(s)', () => {
    expect(() =>
      renderEmailLayout({
        ...input,
        button: { label: 'x', url: 'javascript:alert(1)' },
      })
    ).toThrow(TypeError)
  })

  it('works with no button', () => {
    const { html, text } = renderEmailLayout({
      ...input,
      button: undefined,
      linkHint: undefined,
    })

    expect(html).not.toContain('href=')
    expect(text).not.toContain('https://')
  })

  describe('text version', () => {
    it('has the same content with no markup', () => {
      const { text } = renderEmailLayout(input)

      expect(text).toBe(
        [
          'Welcome',
          '',
          'First paragraph.',
          '',
          'Second paragraph.',
          '',
          'Open:',
          'https://example.com/go?a=1&b=2',
          '',
          'Ignore this if you did not ask.',
          '',
          '--',
          'Sent by Shop.',
        ].join('\n')
      )
    })

    it('does not escape', () => {
      const { text } = renderEmailLayout({
        ...input,
        paragraphs: ['Fish & <chips>'],
      })

      expect(text).toContain('Fish & <chips>')
    })
  })
})

describe('test email', () => {
  it('has a subject, html and text in English', () => {
    const email = renderTestEmail(context())

    expect(email.subject).toBe('Test email from Acme Shop')
    expect(email.html).toContain('Email works')
    expect(email.text).toContain('This is a test email from Acme Shop.')
    expect(email.text).toContain('This email was sent by Acme Shop.')
  })

  it('translates to pt-BR', () => {
    const email = renderTestEmail(context('pt-BR'))

    expect(email.subject).toBe('E-mail de teste de Acme Shop')
    expect(email.html).toContain('lang="pt-BR"')
    expect(email.text).toContain('O e-mail funciona')
  })

  it('escapes the site name in the HTML and keeps it plain in the text and the subject', () => {
    const email = renderTestEmail(context('en', '<b>Tom & Co</b>'))

    expect(email.html).not.toContain('<b>')
    expect(email.html).toContain('&lt;b&gt;Tom &amp; Co&lt;/b&gt;')
    expect(email.text).toContain('<b>Tom & Co</b>')
  })

  it('keeps the subject on one line', () => {
    expect(
      renderTestEmail(context('en', 'Shop\r\nBcc: evil@example.com')).subject
    ).not.toMatch(/[\r\n]/)
  })
})

describe('invite email', () => {
  const url =
    'https://shop.example.com/admin/accept-invite?token_hash=abc&type=invite'

  it('has the link as a button and as plain text', () => {
    const email = renderInviteEmail(context(), { url })

    expect(email.subject).toBe('You are invited to Acme Shop')
    expect(email.html).toContain('Accept the invitation')
    expect(email.html).toContain(
      'href="https://shop.example.com/admin/accept-invite?token_hash=abc&amp;type=invite"'
    )
    expect(email.text).toContain(url)
    expect(email.text).toContain('You were invited to help manage Acme Shop.')
    expect(email.text).toContain(
      'If you did not expect this email, you can ignore it.'
    )
  })

  it('names the inviter and the roles', () => {
    const email = renderInviteEmail(context(), {
      url,
      inviterName: 'Ana',
      roles: ['Editor', 'Reviewer'],
    })

    expect(email.text).toContain('Ana invited you to help manage Acme Shop.')
    expect(email.text).toContain('Your role: Editor, Reviewer.')
  })

  it('leaves out an empty inviter and empty roles', () => {
    const email = renderInviteEmail(context(), {
      url,
      inviterName: '  ',
      roles: ['', ' '],
    })

    expect(email.text).toContain('You were invited to help manage Acme Shop.')
    expect(email.text).not.toContain('Your role')
  })

  it('escapes the inviter and the roles in the HTML', () => {
    const email = renderInviteEmail(context(), {
      url,
      inviterName: '<img src=x onerror=alert(1)>',
      roles: ['<script>'],
    })

    expect(email.html).not.toContain('<img')
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('translates to pt-BR', () => {
    const email = renderInviteEmail(context('pt-BR'), {
      url,
      inviterName: 'Ana',
      roles: ['Editor'],
    })

    expect(email.subject).toBe('Você foi convidado para Acme Shop')
    expect(email.text).toContain(
      'Ana convidou você para ajudar a gerenciar Acme Shop.'
    )
    expect(email.text).toContain('Seu papel: Editor.')
    expect(email.html).toContain('Aceitar o convite')
  })

  it('refuses a link that is not http(s)', () => {
    expect(() =>
      renderInviteEmail(context(), { url: 'javascript:alert(1)' })
    ).toThrow(TypeError)
  })
})

describe('renderPlutoEmail', () => {
  it('renders a template with the translator and the site name from the config', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { websiteName: 'Config Shop' },
    }))
    const { renderPlutoEmail } = await import('../server/utils/pluto-mail')

    const ctx = context('pt-BR')
    const email = await renderPlutoEmail(
      'test',
      {},
      { translator: { t: ctx.t, locale: ctx.locale } }
    )

    expect(email.subject).toBe('E-mail de teste de Config Shop')
  })

  it('renders the invite template', async () => {
    const { renderPlutoEmail } = await import('../server/utils/pluto-mail')

    const ctx = context()
    const email = await renderPlutoEmail(
      'invite',
      { url: 'https://example.com/a' },
      { siteName: 'Own Name', translator: { t: ctx.t, locale: ctx.locale } }
    )

    expect(email.subject).toBe('You are invited to Own Name')
    expect(email.text).toContain('https://example.com/a')
  })

  it('rejects an unknown template', async () => {
    const { renderPlutoEmail } = await import('../server/utils/pluto-mail')
    const ctx = context()

    await expect(
      renderPlutoEmail(
        'nope' as 'test',
        {},
        { siteName: 'S', translator: { t: ctx.t, locale: ctx.locale } }
      )
    ).rejects.toMatchObject({ code: 'invalid_message' })
  })
})
