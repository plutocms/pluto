import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { buildContentPayload } from '../app/composables/internal/content-payload'

const type: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'body', type: 'richtext', label: 'Body' },
  ],
}

describe('buildContentPayload', () => {
  it('copies the declared fields that the item has', () => {
    expect(buildContentPayload(type, { id: 1, title: 'Hello' })).toEqual({
      title: 'Hello',
    })
  })

  it('keeps a declared field with an empty value', () => {
    expect(buildContentPayload(type, { id: 1, title: '', body: null })).toEqual(
      { title: '', body: null }
    )
  })

  it('drops undeclared keys', () => {
    const payload = buildContentPayload(type, {
      id: 1,
      title: 'Hello',
      extra: 'x',
      created_at: 'now',
    })

    expect(payload).toEqual({ title: 'Hello' })
  })

  it('sets status only when an override is given', () => {
    expect(
      buildContentPayload(type, { id: 1, title: 'A', status: 'draft' })
    ).toEqual({ title: 'A' })
    expect(
      buildContentPayload(
        type,
        { id: 1, title: 'A', status: 'draft' },
        'published'
      )
    ).toEqual({
      title: 'A',
      status: 'published',
    })
  })

  it('passes _version through when the item has it', () => {
    expect(
      buildContentPayload(type, { id: 'a', title: 'A', _version: 'sha1' })
    ).toEqual({
      title: 'A',
      _version: 'sha1',
    })
  })

  it('leaves _version out when the item has none', () => {
    expect(
      buildContentPayload(type, { id: 'a', title: 'A' })
    ).not.toHaveProperty('_version')
  })

  it('returns an empty payload without a type', () => {
    expect(
      buildContentPayload(undefined, { id: 1, title: 'A', _version: 'v' })
    ).toEqual({})
  })
})
