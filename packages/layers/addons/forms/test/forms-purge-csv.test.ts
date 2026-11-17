import { createStorage } from 'unstorage'
import memory from 'unstorage/drivers/memory'
import { describe, expect, it, vi } from 'vitest'
import { purgeFormSubmissions } from '../server/utils/forms-purge'
import { createStorageFormStore } from '../server/utils/forms-store'
import { plutoCsvCell, plutoFormsCsv } from '../shared/utils/forms-csv'

const DAY = 24 * 60 * 60 * 1000

describe('purgeFormSubmissions', () => {
  it('deletes the submissions older than the retention of each form', async () => {
    const now = new Date('2026-06-01T00:00:00Z')
    const store = createStorageFormStore(createStorage({ driver: memory() }))
    for (const [form, age] of [
      ['short', 40],
      ['short', 5],
      ['long', 40],
      ['forever', 4000],
    ] as const) {
      await store.add({
        form,
        values: { age: String(age) },
        createdAt: new Date(now.getTime() - age * DAY).toISOString(),
      })
    }

    const result = await purgeFormSubmissions(
      store,
      [
        { handle: 'short', retentionDays: 30 },
        { handle: 'long', retentionDays: 180 },
        { handle: 'forever', retentionDays: 0 },
      ],
      now
    )

    expect(result).toEqual({ purged: 1, failed: [] })
    expect((await store.list('short', { limit: 10, offset: 0 })).total).toBe(1)
    expect((await store.list('long', { limit: 10, offset: 0 })).total).toBe(1)
    expect((await store.list('forever', { limit: 10, offset: 0 })).total).toBe(1)
  })

  it('goes on when one form fails', async () => {
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createStorageFormStore(createStorage({ driver: memory() }))
    const purge = store.purge
    store.purge = async (form, date) => {
      if (form === 'bad') {
        throw new Error('down')
      }
      return purge(form, date)
    }

    const result = await purgeFormSubmissions(store, [
      { handle: 'bad', retentionDays: 1 },
      { handle: 'good', retentionDays: 1 },
    ])

    expect(result.failed).toEqual(['bad'])
    quiet.mockRestore()
  })
})

describe('the CSV export', () => {
  it('puts a quote before a text that a spreadsheet could run as a formula', () => {
    for (const bad of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx']) {
      expect(plutoCsvCell(bad).replace(/^"/, '').startsWith('\'')).toBe(true)
    }
    expect(plutoCsvCell('=HYPERLINK("http://evil","x")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""x"")"'
    )
  })

  it('keeps a number and a normal text as they are, and quotes what needs it', () => {
    expect(plutoCsvCell(-5)).toBe('-5')
    expect(plutoCsvCell('hello')).toBe('hello')
    expect(plutoCsvCell('a,b')).toBe('"a,b"')
    expect(plutoCsvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(plutoCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(plutoCsvCell(undefined)).toBe('')
  })

  it('writes a header with the labels, and a row for each submission', () => {
    const csv = plutoFormsCsv(
      [
        { name: 'name', type: 'text', label: 'Name' },
        { name: 'news', type: 'checkbox', label: 'News' },
      ],
      [
        {
          id: '1',
          form: 'c',
          createdAt: '2026-01-01T00:00:00.000Z',
          values: { name: '=cmd|\' /C calc\'!A0', news: true, old: 'kept' },
        },
      ]
    )

    const lines = csv.replace(String.fromCharCode(0xFEFF), '').trim().split('\r\n')

    expect(lines[0]).toBe('id,date,Name,News,old')
    expect(lines[1]).toBe('1,2026-01-01T00:00:00.000Z,\'=cmd|\' /C calc\'!A0,yes,kept')
  })
})
