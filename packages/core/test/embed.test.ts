import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../shared/markdown/render'
import { sanitizeHtml } from '../shared/markdown/sanitize-html'
import {
  decodeHtmlEntities,
  hasEmbedParagraph,
  matchVimeoUrl,
  matchYoutubeUrl,
  resolveEmbed,
  splitEmbedHtml,
} from '../shared/utils/embed'

const youtube = (href: string) => matchYoutubeUrl(new URL(href))
const vimeo = (href: string) => matchVimeoUrl(new URL(href))

describe('the embed paragraph of the renderer', () => {
  it('marks a URL alone on its line, and [url](url) of the Visual editor', () => {
    for (const markdown of [
      'https://youtu.be/dQw4w9WgXcQ',
      '[https://youtu.be/dQw4w9WgXcQ](https://youtu.be/dQw4w9WgXcQ)',
      '<https://youtu.be/dQw4w9WgXcQ>',
    ]) {
      expect(renderMarkdown(markdown), markdown).toBe(
        '<p data-pluto-embed=""><a href="https://youtu.be/dQw4w9WgXcQ">https://youtu.be/dQw4w9WgXcQ</a></p>\n'
      )
    }
  })

  it('does not mark a URL in a sentence, a link with other text, or a URL that is not http', () => {
    for (const markdown of [
      'Watch https://youtu.be/dQw4w9WgXcQ now',
      '[Watch](https://youtu.be/dQw4w9WgXcQ)',
      'https://youtu.be/a https://youtu.be/b',
      'mailto:a@b.c',
      '[ftp://x.y](ftp://x.y)',
    ]) {
      expect(renderMarkdown(markdown), markdown).not.toContain(
        'data-pluto-embed'
      )
    }
  })
})

describe('the sanitizer', () => {
  it('keeps data-pluto-embed on a paragraph only, always empty', () => {
    expect(
      sanitizeHtml(
        '<p data-pluto-embed="x" onclick="a()"><a href="https://a.b">l</a></p>'
      )
    ).toBe('<p data-pluto-embed=""><a href="https://a.b">l</a></p>')
    expect(
      sanitizeHtml(
        '<div data-pluto-embed=""><a href="https://a.b" data-pluto-embed="">l</a></div>'
      )
    ).toBe('<a href="https://a.b">l</a>')
  })
})

describe('matchYoutubeUrl', () => {
  it('reads the id from each URL form, and the start time', () => {
    for (const href of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&list=x',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]) {
      expect(youtube(href), href).toEqual({ id: 'dQw4w9WgXcQ' })
    }
    expect(youtube('https://youtu.be/dQw4w9WgXcQ?t=90')).toEqual({
      id: 'dQw4w9WgXcQ',
      start: '90',
    })
    expect(
      youtube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s')
    ).toEqual({ id: 'dQw4w9WgXcQ', start: '90' })
  })

  it('refuses other hosts, bad ids and other schemes', () => {
    for (const href of [
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'https://evil.com/youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
      'https://www.youtube.com/channel/UC123',
      'ftp://youtu.be/dQw4w9WgXcQ',
    ]) {
      expect(youtube(href), href).toBeNull()
    }
  })
})

describe('matchVimeoUrl', () => {
  it('reads the id, and the hash of an unlisted video', () => {
    expect(vimeo('https://vimeo.com/76979871')).toEqual({ id: '76979871' })
    expect(vimeo('https://vimeo.com/76979871/abc123def0')).toEqual({
      id: '76979871',
      hash: 'abc123def0',
    })
    expect(vimeo('https://vimeo.com/channels/staffpicks/76979871')).toEqual({
      id: '76979871',
    })
    expect(
      vimeo('https://player.vimeo.com/video/76979871?h=abc123def0')
    ).toEqual({ id: '76979871', hash: 'abc123def0' })
  })

  it('refuses other hosts and ids that are not digits', () => {
    for (const href of [
      'https://vimeo.com.evil.com/76979871',
      'https://vimeo.com/about',
      'https://vimeo.com/76979871/not-a-hash!',
    ]) {
      const match = vimeo(href)
      expect(match === null || !('hash' in match), href).toBe(true)
    }
    expect(vimeo('https://vimeo.com.evil.com/76979871')).toBeNull()
    expect(vimeo('https://vimeo.com/about')).toBeNull()
  })
})

describe('splitEmbedHtml', () => {
  it('gives the top-level parts, flat, with the embed URL decoded', () => {
    const html = renderMarkdown(
      '# Title\n\nSome *text* & more.\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5\n\n- a\n- b'
    )
    expect(hasEmbedParagraph(html)).toBe(true)
    const parts = splitEmbedHtml(html)

    expect(parts.map((part) => part.kind)).toEqual([
      'element',
      'element',
      'embed',
      'element',
    ])
    expect(parts[0]).toMatchObject({ tag: 'h1', inner: 'Title' })
    expect(parts[1]).toMatchObject({
      tag: 'p',
      inner: 'Some <em>text</em> &amp; more.',
    })
    expect(parts[2]).toMatchObject({
      href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5',
    })
    expect(parts[3]).toMatchObject({ tag: 'ul' })
  })

  it('decodes the entities of the sanitizer', () => {
    expect(
      decodeHtmlEntities('a &amp; b &quot;c&quot; &lt;d &#39;e&#x27;')
    ).toBe('a & b "c" <d \'e\'')
  })
})

describe('resolveEmbed', () => {
  const providers = [
    { id: 'youtube', match: matchYoutubeUrl },
    { id: 'vimeo', match: matchVimeoUrl },
  ]

  it('takes the first provider that matches, or none', () => {
    expect(
      resolveEmbed(providers, 'https://vimeo.com/76979871')?.provider.id
    ).toBe('vimeo')
    expect(resolveEmbed(providers, 'https://example.com/')).toBeNull()
    expect(resolveEmbed(providers, 'not a url')).toBeNull()
  })
})
