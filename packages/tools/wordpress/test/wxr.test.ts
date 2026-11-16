import { describe, expect, it } from 'vitest'
import { readWxr } from '../src/wxr'
import { wxrOf } from './fixtures'

describe('readWxr', () => {
  it('reads the channel and every post', () => {
    const wxr = readWxr(
      wxrOf([
        {
          id: 1,
          type: 'page',
          title: 'Home',
          slug: 'home',
          meta: { _elementor_data: '[]' },
        },
        {
          id: 2,
          type: 'attachment',
          title: 'logo',
          attachmentUrl: 'https://old.example.test/logo.png',
        },
      ])
    )

    expect(wxr.title).toBe('Example')
    expect(wxr.baseUrl).toBe('https://old.example.test')
    expect(wxr.posts.map((post) => post.type)).toEqual(['page', 'attachment'])
    expect(wxr.posts[1]!.attachmentUrl).toBe(
      'https://old.example.test/logo.png'
    )
  })

  it('reads CDATA, the meta of a post and the JSON in it', () => {
    const data = JSON.stringify([
      { elType: 'container', settings: { a: '<b>&</b>' } },
    ])
    const wxr = readWxr(
      wxrOf([
        {
          id: 7,
          type: 'page',
          title: 'A &amp; B',
          slug: 'a-b',
          parent: 3,
          content: '<p>Body & more</p>',
          meta: { _elementor_data: data, _plain: 'x' },
        },
      ])
    )
    const [post] = wxr.posts

    expect(post!.id).toBe(7)
    expect(post!.parent).toBe(3)
    expect(post!.title).toBe('A & B')
    expect(post!.content).toBe('<p>Body & more</p>')
    expect(JSON.parse(post!.meta._elementor_data!)).toEqual([
      { elType: 'container', settings: { a: '<b>&</b>' } },
    ])
    expect(post!.meta._plain).toBe('x')
  })

  it('reads one post as a list, and a post with no meta', () => {
    const wxr = readWxr(wxrOf([{ id: 1, type: 'page', title: 'Only' }]))

    expect(wxr.posts).toHaveLength(1)
    expect(wxr.posts[0]!.meta).toEqual({})
  })

  it('reads the front page of the channel', () => {
    const wxr = readWxr(
      wxrOf(
        [{ id: 5, type: 'page', title: 'Start' }],
        '<wp:page_on_front>5</wp:page_on_front>'
      )
    )

    expect(wxr.frontPageId).toBe(5)
  })

  it('refuses a file that is not a WordPress export', () => {
    expect(() => readWxr('<html></html>')).toThrow('not a WordPress export')
  })
})
