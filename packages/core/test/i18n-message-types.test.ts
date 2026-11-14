import { describe, expect, it } from 'vitest'
import {
  messagePlaceholders,
  renderMessageTypes,
} from '../modules/pluto-i18n/locale-files'

describe('messagePlaceholders', () => {
  it('lists each placeholder once, sorted', () => {
    expect(messagePlaceholders('{b} and {a} and {b}')).toEqual(['a', 'b'])
  })

  it('adds count to a plural message', () => {
    expect(messagePlaceholders('One post | {n} posts')).toEqual(['count', 'n'])
  })

  it('gives no names for plain text and MDC attributes', () => {
    expect(messagePlaceholders('Open {target="_blank"}')).toEqual([])
  })
})

describe('renderMessageTypes', () => {
  it('merges the layers, the app last, and maps each key to its placeholders', () => {
    const text = renderMessageTypes([
      {
        pluto: {
          nav: { home: 'Home' },
          content: { new: 'New {label}' },
        },
      },
      {
        pluto: { nav: { home: 'Start {site}' } },
        app: { posts: 'One post | {count} posts' },
      },
    ])

    expect(text).toContain('interface PlutoMessages {')
    expect(text).toContain('"app.posts": "count"')
    expect(text).toContain('"pluto.content.new": "label"')
    expect(text).toContain('"pluto.nav.home": "site"')
  })

  it('maps a message with no placeholders to never', () => {
    expect(renderMessageTypes([{ a: { b: 'Text' } }])).toContain('"a.b": never')
  })
})
