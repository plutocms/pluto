import type { PlutoContentType } from '../shared/types/content'
import type { PlutoContentBackup } from '../shared/utils/content-backup'
import { describe, expect, it } from 'vitest'
import {
  backupChanges,
  backupFields,
  keepaliveBody,
  parseBackup,
  pickBackup,
  planRestore,
} from '../shared/utils/content-backup'

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
    { name: 'tags', type: 'text', label: 'Tags' },
  ],
  slug: { field: 'slug' },
  status: {
    column: 'status',
    default: 'draft',
    publishedValue: 'published',
    values: [],
  },
}
const fields = backupFields(type)
const names = fields.map((field) => field.name)

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

function record(patch: Partial<PlutoContentBackup> = {}): PlutoContentBackup {
  return {
    v: 1,
    savedAt: NOW - 1000,
    device: 'device-a',
    tab: 'tab-a',
    changes: {},
    ...patch,
  }
}

describe('backupFields', () => {
  it('keeps the slug and the virtual fields, and drops the status and inForm: false', () => {
    expect(names).toEqual(['title', 'slug', 'note', 'tags'])
  })

  it('reads a status column that is not named status', () => {
    const named = {
      ...type,
      status: { ...type.status!, column: 'state' },
    }
    expect(backupFields(named).map((field) => field.name)).toContain('status')
  })
})

describe('backupChanges', () => {
  it('holds only the fields that differ, with both values', () => {
    expect(
      backupChanges(
        fields,
        { title: 'A', slug: 'a', _version: '1' },
        { title: 'B', slug: 'a', _version: '2' }
      )
    ).toEqual({ title: { base: 'A', value: 'B' } })
  })

  it('is empty when the values are equal, whatever the key order', () => {
    expect(
      backupChanges(
        fields,
        { tags: { b: 1, a: [1, 2] } },
        { tags: { a: [1, 2], b: 1 } }
      )
    ).toEqual({})
  })

  it('ignores a key that is not a backup field', () => {
    expect(backupChanges(fields, { hidden: 'a' }, { hidden: 'b' })).toEqual({})
  })
})

describe('parseBackup', () => {
  const options = { now: NOW, ttlMs: 14 * DAY }

  it('reads a good record', () => {
    const value = record({
      version: 'v1',
      slugTouched: true,
      changes: { title: { base: 'A', value: 'B' } },
    })
    expect(parseBackup(JSON.parse(JSON.stringify(value)), options)).toEqual(
      value
    )
  })

  it('refuses a wrong shape', () => {
    expect(parseBackup(null, options)).toBeNull()
    expect(parseBackup('text', options)).toBeNull()
    expect(parseBackup([], options)).toBeNull()
    expect(parseBackup({ ...record(), changes: [] }, options)).toBeNull()
    expect(parseBackup({ ...record(), savedAt: 'now' }, options)).toBeNull()
  })

  it('refuses a wrong version of the schema', () => {
    expect(parseBackup({ ...record(), v: 2 }, options)).toBeNull()
  })

  it('refuses a record with no device', () => {
    const { device: _device, ...rest } = record()
    expect(parseBackup(rest, options)).toBeNull()
    expect(parseBackup({ ...record(), device: '' }, options)).toBeNull()
  })

  it('refuses an expired record', () => {
    expect(parseBackup(record({ savedAt: NOW - 15 * DAY }), options)).toBeNull()
    expect(
      parseBackup(record({ savedAt: NOW - 13 * DAY }), options)
    ).not.toBeNull()
  })

  it('drops the fields that the type does not declare', () => {
    const parsed = parseBackup(
      record({
        changes: {
          title: { base: 'A', value: 'B' },
          gone: { base: 'A', value: 'B' },
        },
      }),
      { ...options, fields }
    )
    expect(Object.keys(parsed!.changes)).toEqual(['title'])
  })
})

describe('planRestore', () => {
  it('restores each changed field', () => {
    const plan = planRestore(
      fields,
      record({
        changes: {
          title: { base: 'A', value: 'B' },
          tags: { base: 'x', value: 'y' },
        },
      }),
      { title: 'A', tags: 'x' }
    )
    expect(plan).toEqual({ values: { title: 'B', tags: 'y' }, conflicts: [] })
  })

  it('leaves a field that only the stored item changed', () => {
    const plan = planRestore(
      fields,
      record({ changes: { title: { base: 'A', value: 'B' } } }),
      { title: 'A', tags: 'stored' }
    )
    expect(plan.values).toEqual({ title: 'B' })
  })

  it('names a field that changed in both places, and the backup wins', () => {
    const plan = planRestore(
      fields,
      record({ changes: { title: { base: 'A', value: 'B' } } }),
      { title: 'C' }
    )
    expect(plan).toEqual({ values: { title: 'B' }, conflicts: ['title'] })
  })

  it('is empty when the backup equals the stored values', () => {
    const plan = planRestore(
      fields,
      record({ changes: { title: { base: 'A', value: 'B' } } }),
      { title: 'B' }
    )
    expect(plan).toEqual({ values: {}, conflicts: [] })
  })

  it('drops a field that is not in the list', () => {
    const plan = planRestore(
      fields,
      record({ changes: { gone: { base: 'A', value: 'B' } } }),
      {}
    )
    expect(plan.values).toEqual({})
  })

  it('restores a field that the backup cleared', () => {
    const plan = planRestore(
      fields,
      record({ changes: { title: { base: 'A' } } }),
      { title: 'A' }
    )
    expect(plan.values).toEqual({ title: null })
  })
})

describe('pickBackup', () => {
  const older = record({ savedAt: 1000, device: 'device-a' })
  const newer = record({ savedAt: 2000, device: 'device-b' })

  it('takes the newer record', () => {
    expect(pickBackup(older, newer, 'device-a')).toMatchObject({
      source: 'server',
      record: newer,
    })
    expect(pickBackup(newer, older, 'device-a')).toMatchObject({
      source: 'local',
      record: newer,
    })
  })

  it('gives a tie to the browser record', () => {
    const tie = record({ savedAt: 1000, device: 'device-b' })
    expect(pickBackup(older, tie, 'device-a')?.source).toBe('local')
  })

  it('takes the only record', () => {
    expect(pickBackup(older, null, 'device-a')?.source).toBe('local')
    expect(pickBackup(null, older, 'device-a')?.source).toBe('server')
  })

  it('gives null for no record', () => {
    expect(pickBackup(null, null, 'device-a')).toBeNull()
  })

  it('marks another device for a server record only', () => {
    expect(pickBackup(null, newer, 'device-a')?.otherDevice).toBe(true)
    expect(pickBackup(null, older, 'device-a')?.otherDevice).toBe(false)
    expect(pickBackup(newer, null, 'device-a')?.otherDevice).toBe(false)
  })
})

describe('keepaliveBody', () => {
  it('gives the JSON text of a small record', () => {
    const small = record({ changes: { title: { base: 'A', value: 'B' } } })
    expect(keepaliveBody(small, 60_000)).toBe(JSON.stringify(small))
  })

  it('gives null above the limit', () => {
    const big = record({
      changes: { title: { base: '', value: 'a'.repeat(61_000) } },
    })
    expect(keepaliveBody(big, 60_000)).toBeNull()
  })

  it('counts bytes, not characters', () => {
    const wide = record({
      changes: { title: { base: '', value: 'é'.repeat(300) } },
    })
    const text = JSON.stringify(wide)
    const bytes = new TextEncoder().encode(text).length
    expect(bytes).toBeGreaterThan(text.length)
    expect(keepaliveBody(wide, text.length)).toBeNull()
    expect(keepaliveBody(wide, bytes)).toBe(text)
  })
})
