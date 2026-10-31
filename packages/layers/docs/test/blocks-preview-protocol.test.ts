import { describe, expect, it } from 'vitest'
import {
  isTrustedPreviewOrigin,
  parsePreviewMessage,
  PREVIEW_PATH,
  previewMessage,
} from '../shared/utils/blocks/preview-protocol'

describe('preview protocol', () => {
  it('accepts the messages to the frame', () => {
    const render = previewMessage('render', {
      frontmatter: { title: 'A' },
      blocks: [
        { id: 'b0', markdown: '# A' },
        { id: 'b1', markdown: '::x\n::', preview: false, label: 'X' },
      ],
      selectedId: null,
    })
    expect(parsePreviewMessage(render, 'to-frame')).toEqual(render)
    const select = previewMessage('select', { id: 'b1' })
    expect(parsePreviewMessage(select, 'to-frame')).toEqual(select)
    expect(
      parsePreviewMessage(previewMessage('select', { id: null }), 'to-frame')
    ).toBeDefined()
    expect(
      parsePreviewMessage(previewMessage('scroll-to', { id: 'b1' }), 'to-frame')
    ).toBeDefined()
  })

  it('accepts the messages from the frame', () => {
    expect(
      parsePreviewMessage(previewMessage('ready', {}), 'from-frame')
    ).toBeDefined()
    expect(
      parsePreviewMessage(previewMessage('select', { id: 'b1' }), 'from-frame')
    ).toBeDefined()
    expect(
      parsePreviewMessage(previewMessage('hover', { id: null }), 'from-frame')
    ).toBeDefined()
    expect(
      parsePreviewMessage(
        previewMessage('error', { id: 'b1', message: 'Failed' }),
        'from-frame'
      )
    ).toBeDefined()
    expect(
      parsePreviewMessage(
        previewMessage('error', { message: 'Failed' }),
        'from-frame'
      )
    ).toBeDefined()
  })

  it('refuses a message in the wrong direction', () => {
    expect(
      parsePreviewMessage(previewMessage('ready', {}), 'to-frame')
    ).toBeUndefined()
    expect(
      parsePreviewMessage(
        previewMessage('render', { frontmatter: {}, blocks: [] }),
        'from-frame'
      )
    ).toBeUndefined()
    expect(
      parsePreviewMessage(
        previewMessage('scroll-to', { id: 'a' }),
        'from-frame'
      )
    ).toBeUndefined()
  })

  it('refuses a clear selection from the frame', () => {
    expect(
      parsePreviewMessage(previewMessage('select', { id: null }), 'from-frame')
    ).toBeUndefined()
  })

  it('refuses anything that is not a message of this protocol', () => {
    for (const value of [
      undefined,
      null,
      'render',
      5,
      [],
      {},
      { type: 'ready' },
      { source: 'other', version: 1, type: 'ready' },
      { source: 'pluto-preview', version: 2, type: 'ready' },
      { source: 'pluto-preview', version: 1, type: 'nope' },
    ]) {
      expect(parsePreviewMessage(value, 'from-frame')).toBeUndefined()
      expect(parsePreviewMessage(value, 'to-frame')).toBeUndefined()
    }
  })

  it('refuses a message with a wrong field', () => {
    const base = { source: 'pluto-preview', version: 1 }
    expect(
      parsePreviewMessage(
        { ...base, type: 'render', frontmatter: [], blocks: [] },
        'to-frame'
      )
    ).toBeUndefined()
    expect(
      parsePreviewMessage(
        { ...base, type: 'render', frontmatter: {}, blocks: [{ id: 'a' }] },
        'to-frame'
      )
    ).toBeUndefined()
    expect(
      parsePreviewMessage(
        {
          ...base,
          type: 'render',
          frontmatter: {},
          blocks: [{ id: 'a', markdown: '', preview: 'no' }],
        },
        'to-frame'
      )
    ).toBeUndefined()
    expect(
      parsePreviewMessage(
        { ...base, type: 'render', frontmatter: {}, blocks: [], selectedId: 3 },
        'to-frame'
      )
    ).toBeUndefined()
    expect(
      parsePreviewMessage({ ...base, type: 'scroll-to' }, 'to-frame')
    ).toBeUndefined()
    expect(
      parsePreviewMessage({ ...base, type: 'hover', id: 4 }, 'from-frame')
    ).toBeUndefined()
    expect(
      parsePreviewMessage({ ...base, type: 'error' }, 'from-frame')
    ).toBeUndefined()
    expect(
      parsePreviewMessage(
        { ...base, type: 'error', message: 'x', id: 7 },
        'from-frame'
      )
    ).toBeUndefined()
  })

  it('trusts only the expected origin', () => {
    expect(
      isTrustedPreviewOrigin('https://site.test', 'https://site.test')
    ).toBe(true)
    expect(
      isTrustedPreviewOrigin('https://evil.test', 'https://site.test')
    ).toBe(false)
    expect(isTrustedPreviewOrigin('null', 'null')).toBe(false)
    expect(isTrustedPreviewOrigin('', '')).toBe(false)
  })

  it('has the route of the preview page', () => {
    expect(PREVIEW_PATH).toBe('/_pluto/preview')
  })
})
