import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  diffFields,
  diffLines,
  diffRevision,
  foldDiff,
  restorableFields,
  revisionRestoreValues,
} from '../shared/utils/content-revision'

const type: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'slug', type: 'slug', label: 'Slug' },
    { name: 'status', type: 'text', label: 'Status' },
    { name: 'note', type: 'text', label: 'Note', virtual: true },
    { name: 'hidden', type: 'text', label: 'Hidden', inForm: false },
    { name: 'cover', type: 'media', label: 'Cover' },
    { name: 'content', type: 'richtext', label: 'Content' },
  ],
  slug: { field: 'slug' },
  status: {
    column: 'status',
    default: 'draft',
    publishedValue: 'published',
    values: [],
  },
}

describe('diffLines', () => {
  it('keeps the common lines and marks the changes', () => {
    expect(diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'remove', text: 'b' },
      { kind: 'add', text: 'B' },
      { kind: 'same', text: 'c' },
      { kind: 'same', text: 'd' },
      { kind: 'add', text: 'e' },
    ])
  })

  it('handles an empty side', () => {
    expect(diffLines('', 'x')).toEqual([
      { kind: 'remove', text: '' },
      { kind: 'add', text: 'x' },
    ])
    expect(diffLines('same', 'same')).toEqual([{ kind: 'same', text: 'same' }])
  })

  it('gives a plain replace for a very large change', () => {
    const before = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n')
    const after = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n')
    const lines = diffLines(`top\n${before}\nend`, `top\n${after}\nend`)
    expect(lines[0]).toEqual({ kind: 'same', text: 'top' })
    expect(lines[1]).toEqual({ kind: 'remove', text: 'a0' })
    expect(lines[3001]).toEqual({ kind: 'add', text: 'b0' })
    expect(lines.at(-1)).toEqual({ kind: 'same', text: 'end' })
  })
})

describe('restore', () => {
  it('copies the stored form fields, not the slug, the status or a virtual field', () => {
    expect(restorableFields(type).map((field) => field.name)).toEqual([
      'title',
      'cover',
      'content',
    ])
    expect(
      revisionRestoreValues(type, {
        id: 'a',
        title: 'Old',
        slug: 'old-slug',
        status: 'draft',
        content: 'Body',
        _version: 'b1',
      })
    ).toEqual({ title: 'Old', cover: null, content: 'Body' })
  })

  it('lists the changed fields: a value pair, or a line diff for long text', () => {
    const changes = diffRevision(
      type,
      { title: 'New', slug: 'x', cover: 'img-1', content: 'one\ntwo' },
      { id: 'a', title: 'Old', slug: 'y', cover: 'img-1', content: 'one\n2' }
    )
    expect(changes).toEqual([
      {
        field: type.fields[0],
        kind: 'value',
        before: 'New',
        after: 'Old',
      },
      {
        field: type.fields[6],
        kind: 'text',
        lines: [
          { kind: 'same', text: 'one' },
          { kind: 'remove', text: 'two' },
          { kind: 'add', text: '2' },
        ],
      },
    ])
  })
})

describe('foldDiff', () => {
  it('keeps the context around a change and folds the rest', () => {
    const lines = diffLines(
      ['1', '2', '3', '4', '5', '6', '7', '8'].join('\n'),
      ['1', '2', '3', '4', 'five', '6', '7', '8'].join('\n')
    )
    expect(foldDiff(lines, 1)).toEqual([
      { kind: 'skip', count: 3 },
      { kind: 'same', text: '4' },
      { kind: 'remove', text: '5' },
      { kind: 'add', text: 'five' },
      { kind: 'same', text: '6' },
      { kind: 'skip', count: 2 },
    ])
  })

  it('shows a single hidden line, not a skip row', () => {
    const lines = diffLines('a\nb\nc', 'A\nb\nc')
    expect(foldDiff(lines, 1)).toEqual([
      { kind: 'remove', text: 'a' },
      { kind: 'add', text: 'A' },
      { kind: 'same', text: 'b' },
      { kind: 'same', text: 'c' },
    ])
  })
})

describe('diffFields', () => {
  const fields = type.fields

  it('lists only the fields that differ, in field order', () => {
    const changes = diffFields(
      fields,
      { title: 'A', note: 'x', content: 'one' },
      { title: 'B', note: 'x', content: 'two' }
    )
    expect(changes.map((change) => change.field.name)).toEqual([
      'title',
      'content',
    ])
  })

  it('shows a short value as before and after, and a long text as a line diff', () => {
    const [title, content] = diffFields(
      fields,
      { title: 'A', content: 'a\nb' },
      { title: 'B', content: 'a\nc' }
    )
    expect(title).toMatchObject({ kind: 'value', before: 'A', after: 'B' })
    expect(content).toMatchObject({ kind: 'text' })
  })

  it('counts a key that the next values do not have as empty', () => {
    const changes = diffFields([fields[0]!], { title: 'A' }, {})
    expect(changes).toMatchObject([{ kind: 'value', before: 'A', after: '' }])
  })

  it('gives the same result as diffRevision for the restorable fields', () => {
    const current = { title: 'A', slug: 'a', content: 'x' }
    const revision = { id: '1', title: 'B', slug: 'b', content: 'y' }
    expect(diffRevision(type, current, revision)).toEqual(
      diffFields(restorableFields(type), current, revision)
    )
  })
})
