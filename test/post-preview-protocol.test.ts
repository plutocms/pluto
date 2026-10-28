import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../shared/markdown/render'
import { plutoPostPreviewHtml } from '../shared/utils/post-preview-html'
import {
  isTrustedPlutoPostPreviewOrigin,
  parsePlutoPostPreviewMessage,
  PLUTO_POST_PREVIEW_SOURCE,
  plutoPostPreviewMessage,
} from '../shared/utils/post-preview-protocol'

describe('post preview protocol', () => {
  it('builds and parses a render message', () => {
    const message = plutoPostPreviewMessage('render', {
      contentType: 'post',
      item: { title: 'Hello' },
      markdown: '# Hi',
    })
    expect(message.source).toBe(PLUTO_POST_PREVIEW_SOURCE)
    expect(parsePlutoPostPreviewMessage(message, 'to-frame')).toEqual(message)
  })

  it('parses a scroll-to message with a heading index', () => {
    const message = plutoPostPreviewMessage('scroll-to', { heading: 2 })
    expect(parsePlutoPostPreviewMessage(message, 'to-frame')).toEqual(message)
    expect(
      parsePlutoPostPreviewMessage({ ...message, heading: -1 }, 'to-frame')
    ).toBeUndefined()
    expect(
      parsePlutoPostPreviewMessage({ ...message, heading: 1.5 }, 'to-frame')
    ).toBeUndefined()
  })

  it('rejects a wrong source, version, direction or field', () => {
    const ready = plutoPostPreviewMessage('ready', {})
    expect(parsePlutoPostPreviewMessage(ready, 'from-frame')).toEqual(ready)
    expect(parsePlutoPostPreviewMessage(ready, 'to-frame')).toBeUndefined()
    expect(
      parsePlutoPostPreviewMessage({ ...ready, source: 'other' }, 'from-frame')
    ).toBeUndefined()
    expect(
      parsePlutoPostPreviewMessage({ ...ready, version: 2 }, 'from-frame')
    ).toBeUndefined()
    expect(
      parsePlutoPostPreviewMessage(
        {
          ...plutoPostPreviewMessage('render', {
            contentType: 'post',
            item: {},
            markdown: '',
          }),
          markdown: 1,
        },
        'to-frame'
      )
    ).toBeUndefined()
    expect(parsePlutoPostPreviewMessage('render', 'to-frame')).toBeUndefined()
  })

  it('trusts only the same origin', () => {
    expect(
      isTrustedPlutoPostPreviewOrigin('https://a.dev', 'https://a.dev')
    ).toBe(true)
    expect(
      isTrustedPlutoPostPreviewOrigin('https://b.dev', 'https://a.dev')
    ).toBe(false)
  })
})

describe('plutoPostPreviewHtml', () => {
  it('renders the same sanitized HTML as the public API', () => {
    const markdown = '## Title\n\n<script>alert(1)</script>\n\nText'
    expect(plutoPostPreviewHtml(markdown)).toBe(renderMarkdown(markdown))
    expect(plutoPostPreviewHtml(markdown)).not.toContain('<script')
  })
})
