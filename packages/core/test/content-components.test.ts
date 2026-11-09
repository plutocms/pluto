import { describe, expect, it } from 'vitest'
import {
  componentMarkerHtml,
  isSafePropName,
  matchEmptyComponent,
  readComponentMarker,
  safeComponentProps,
  writeEmptyComponent,
} from '../shared/markdown/component'
import { renderMarkdown, stripMdc } from '../shared/markdown/render'
import { sanitizeHtml } from '../shared/markdown/sanitize-html'

describe('matchEmptyComponent', () => {
  it('reads the name and the inline props', () => {
    expect(
      matchEmptyComponent(`::my-card{title="Hi" :count='3' wide}\n::\n`)
    ).toEqual({
      raw: `::my-card{title="Hi" :count='3' wide}\n::\n`,
      name: 'my-card',
      props: { title: 'Hi', count: 3, wide: true },
      braces: `title="Hi" :count='3' wide`,
      colons: 2,
    })
  })

  it('takes blank lines, no braces, more colons, and the end of the text', () => {
    expect(matchEmptyComponent('::rule\n\n::')?.name).toBe('rule')
    expect(matchEmptyComponent(':::rule\n:::\n')?.name).toBe('rule')
    expect(matchEmptyComponent('::rule{}\n::\n')?.props).toEqual({})
  })

  it('does not take a component with content, a YAML block, or other colons', () => {
    expect(matchEmptyComponent('::note\nText\n::\n')).toBeUndefined()
    expect(matchEmptyComponent('::note\n---\na: 1\n---\n::\n')).toBeUndefined()
    expect(matchEmptyComponent(':::note\n::\n')).toBeUndefined()
    expect(matchEmptyComponent('text ::note\n::\n')).toBeUndefined()
  })
})

describe('safe props', () => {
  it('refuses events, Vue internals, raw HTML and style', () => {
    for (const name of ['onClick', 'onclick', 'on-click', 'key', 'ref', 'is', 'style', 'innerHTML', 'textContent']) {
      expect(isSafePropName(name)).toBe(false)
    }
    for (const name of ['title', 'to', 'star-count', 'starCount', 'icon']) {
      expect(isSafePropName(name)).toBe(true)
    }
  })

  it('drops script URLs, also in a list or an object', () => {
    expect(
      safeComponentProps({
        to: 'javascript:alert(1)',
        href: 'java&#115;cript:alert(1)',
        src: ' data:text/html,<script>',
        image: 'data:image/png;base64,AAAA',
        link: 'https://example.com',
        note: 'Note: this stays',
        items: ['ok', 'vbscript:x'],
        nested: { a: 'javascript:x', b: 2 },
      })
    ).toEqual({
      image: 'data:image/png;base64,AAAA',
      link: 'https://example.com',
      note: 'Note: this stays',
      items: ['ok'],
      nested: { b: 2 },
    })
  })
})

describe('the mark', () => {
  it('writes and reads the same component', () => {
    const html = componentMarkerHtml('my-card', {
      title: 'A "quote" & <tag>',
      count: 2,
    })
    expect(html).toBe(
      '<div data-pluto-component="my-card" data-pluto-props="{&quot;title&quot;:&quot;A \\&quot;quote\\&quot; &amp; &lt;tag&gt;&quot;,&quot;count&quot;:2}"></div>\n'
    )
    const attributes = {
      'data-pluto-component': 'my-card',
      'data-pluto-props': html.match(/data-pluto-props="([^"]*)"/)![1]!,
    }
    expect(readComponentMarker(attributes)).toEqual({
      name: 'my-card',
      props: { title: 'A "quote" & <tag>', count: 2 },
    })
  })

  it('gives undefined for a bad name, and {} for bad props', () => {
    expect(readComponentMarker({ 'data-pluto-component': 'x y' })).toBeUndefined()
    expect(readComponentMarker({})).toBeUndefined()
    expect(
      readComponentMarker({
        'data-pluto-component': 'card',
        'data-pluto-props': 'not json',
      })
    ).toEqual({ name: 'card', props: {} })
  })
})

describe('renderMarkdown', () => {
  it('renders an empty top-level component as the mark', () => {
    const html = renderMarkdown(
      `Before\n\n::my-card{title="Hi" :count='3'}\n::\n\nAfter\n`
    )
    expect(html).toBe(
      '<p>Before</p>\n<div data-pluto-component="my-card" data-pluto-props="{&quot;title&quot;:&quot;Hi&quot;,&quot;count&quot;:3}"></div>\n<p>After</p>\n'
    )
  })

  it('cuts a paragraph before the component', () => {
    expect(renderMarkdown('Text\n::rule\n::\n')).toContain(
      '<p>Text</p>\n<div data-pluto-component="rule"'
    )
  })

  it('keeps the old rule for a component with content, or inside another', () => {
    expect(renderMarkdown('::note\nHello\n::\n')).toBe('<p>Hello</p>\n')
    expect(
      renderMarkdown('::outer\n::inner{a="b"}\n::\nText\n::\n')
    ).not.toContain('data-pluto-component')
  })

  it('leaves code fences alone', () => {
    expect(renderMarkdown('```md\n::card\n::\n```\n')).not.toContain(
      'data-pluto-component'
    )
  })

  it('drops unsafe props on the way', () => {
    expect(
      renderMarkdown('::card{to="javascript:alert(1)" onclick="x" title="T"}\n::\n')
    ).toBe(
      '<div data-pluto-component="card" data-pluto-props="{&quot;title&quot;:&quot;T&quot;}"></div>\n'
    )
  })

  it('stripMdc keeps the empty component lines', () => {
    expect(stripMdc('::card{a="b"}\n\n::\n')).toBe('::card{a="b"}\n\n::\n')
  })
})

describe('the sanitizer and the mark', () => {
  it('keeps a valid mark, empty, with its props written again', () => {
    expect(
      sanitizeHtml(
        '<div data-pluto-component="card" data-pluto-props="{&quot;title&quot;:&quot;T&quot;,&quot;onclick&quot;:&quot;x&quot;}" onclick="alert(1)" class="x"><script>alert(1)</script>child</div>'
      )
    ).toBe(
      '<div data-pluto-component="card" data-pluto-props="{&quot;title&quot;:&quot;T&quot;}"></div>'
    )
  })

  it('unwraps a div with no valid mark', () => {
    expect(sanitizeHtml('<div class="x">text</div>')).toBe('text')
    expect(
      sanitizeHtml('<div data-pluto-component="a b">text</div>')
    ).toBe('text')
  })
})

describe('writeEmptyComponent', () => {
  it('writes the name and the props', () => {
    expect(writeEmptyComponent('card', {})).toBe('::card\n::')
    expect(
      writeEmptyComponent('card', { title: 'Hi', count: 3, wide: true })
    ).toBe(`::card{title="Hi" :count='3' wide}\n::`)
  })

  it('keeps the text of an unchanged prop, and the colons', () => {
    expect(
      writeEmptyComponent(
        'card',
        { title: 'Hi', count: 4, extra: 'x' },
        { braces: `title='Hi'  :count="3"`, colons: 3 }
      )
    ).toBe(`:::card{title='Hi' :count='4' extra="x"}\n:::`)
  })

  it('reads every prop for an editor with safe: false', () => {
    expect(
      matchEmptyComponent('::card{onclick="x" title="T"}\n::\n', {
        safe: false,
      })?.props
    ).toEqual({ onclick: 'x', title: 'T' })
  })
})
