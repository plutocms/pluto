import type { PlutoField } from '../shared/types/content'
import { describe, expect, it } from 'vitest'
import { formatListValue } from '../shared/utils/content-list'

const plain: PlutoField = { name: 'title', type: 'text', label: 'Title' }

describe('formatListValue', () => {
  it('shows a raw value as text when the field has no formatter', () => {
    expect(formatListValue(plain, { id: 1, title: 'Hello' })).toBe('Hello')
    expect(formatListValue({ ...plain, name: 'n' }, { id: 1, n: 5 })).toBe('5')
  })

  it('shows an empty string for an empty value', () => {
    expect(formatListValue(plain, { id: 1 })).toBe('')
    expect(formatListValue(plain, { id: 1, title: null })).toBe('')
  })

  it('shows an object as JSON', () => {
    expect(formatListValue(plain, { id: 1, title: { a: 1 } })).toBe('{"a":1}')
  })

  it('uses listFormat with the value and the item', () => {
    const price: PlutoField = {
      name: 'price',
      type: 'number',
      label: 'Price',
      listFormat: (value, item) => `${item.currency} ${((value as number) / 100).toFixed(2)}`,
    }
    expect(formatListValue(price, { id: 1, price: 4990, currency: 'R$' })).toBe('R$ 49.90')
  })

  it('turns a nullish formatter result into an empty string', () => {
    const field = { ...plain, listFormat: () => undefined as unknown as string }
    expect(formatListValue(field, { id: 1, title: 'x' })).toBe('')
  })

  it('falls back to the raw value when the formatter throws', () => {
    const field: PlutoField = {
      ...plain,
      listFormat: () => {
        throw new Error('bad')
      },
    }
    expect(formatListValue(field, { id: 1, title: 'Hello' })).toBe('Hello')
  })
})
