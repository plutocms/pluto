import type { PlutoContentType } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import {
  initialValues,
  keepKnownIds,
  readRemembered,
  rememberFields,
  rememberKey,
  writeRemembered,
} from '../app/composables/internal/form-initial-values'

const type: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  titleField: 'title',
  fields: [
    { name: 'title', type: 'text', label: 'Title' },
    { name: 'kind', type: 'text', label: 'Kind', default: 'note' },
    { name: 'flags', type: 'text', label: 'Flags', default: ['a'] },
    {
      name: 'authors',
      type: 'reference',
      label: 'Authors',
      target: 'author',
      multiple: true,
      remember: true,
      default: ['house'],
    },
    {
      name: 'editor',
      type: 'reference',
      label: 'Editor',
      target: 'author',
      remember: true,
    },
    // `remember` without `target` does not count.
    {
      name: 'other',
      type: 'reference',
      label: 'Other',
      optionsUrl: '/x',
      remember: true,
    },
  ],
}

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
  }
}

describe('initialValues', () => {
  it('applies the defaults, then the remembered values', () => {
    expect(initialValues(type)).toEqual({
      kind: 'note',
      flags: ['a'],
      authors: ['house'],
    })
    expect(
      initialValues(type, { authors: ['ana', 'bo'], editor: 'ana', other: 'x' })
    ).toEqual({
      kind: 'note',
      flags: ['a'],
      authors: ['ana', 'bo'],
      editor: 'ana',
    })
  })

  it('keeps the default when the remembered value is empty', () => {
    expect(initialValues(type, { authors: [] }).authors).toEqual(['house'])
  })

  it('copies the values, so the type default never changes', () => {
    const values = initialValues(type)
    ;(values.flags as string[]).push('b')
    expect(initialValues(type).flags).toEqual(['a'])
  })

  it('lists the remember fields with a target only', () => {
    expect(rememberFields(type).map((field) => field.name)).toEqual([
      'authors',
      'editor',
    ])
  })
})

describe('the remembered value', () => {
  it('has one key per site, user, type and field', () => {
    const key = rememberKey({
      base: '/',
      userId: 'u1',
      type: 'post',
      field: 'authors',
    })
    expect(key).toBe('pluto:remember:["/","u1","post","authors"]')
    expect(key).not.toBe(
      rememberKey({ base: '/', userId: 'u2', type: 'post', field: 'authors' })
    )
  })

  it('writes, reads and removes a value', () => {
    const storage = memoryStorage()
    writeRemembered(storage, 'k', ['ana'])
    expect(readRemembered(storage, 'k')).toEqual(['ana'])
    writeRemembered(storage, 'k', [])
    expect(storage.data.has('k')).toBe(false)
    expect(readRemembered(storage, 'k')).toBeUndefined()
  })

  it('reads a broken value as none, and ignores a storage error', () => {
    const storage = memoryStorage()
    storage.data.set('k', '{broken')
    expect(readRemembered(storage, 'k')).toBeUndefined()
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    expect(() => writeRemembered(full, 'k', ['ana'])).not.toThrow()
  })
})

describe('keepKnownIds', () => {
  const known = new Set(['ana', '7'])

  it('drops the ids with no item', () => {
    expect(keepKnownIds({ multiple: true }, ['bo', 'ana'], known)).toEqual([
      'ana',
    ])
    expect(keepKnownIds({ multiple: true }, 'ana', known)).toEqual([])
    expect(keepKnownIds({}, 7, known)).toBe(7)
    expect(keepKnownIds({}, 'bo', known)).toBeUndefined()
  })
})
