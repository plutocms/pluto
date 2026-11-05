import { describe, expect, it } from 'vitest'
import {
  amountToCents,
  centsToAmount,
  digitsToCents,
  formatProductPrice,
} from '../shared/utils/product-price'

describe('amountToCents', () => {
  it('converts 49.90 to 4990', () => {
    expect(amountToCents(49.9)).toBe(4990)
  })

  it('converts 0 to 0', () => {
    expect(amountToCents(0)).toBe(0)
  })

  it('has no float drift', () => {
    expect(amountToCents(0.1 + 0.2)).toBe(30)
    expect(amountToCents(0.1)).toBe(10)
    expect(amountToCents(1.005)).toBe(101)
    expect(amountToCents(19.99)).toBe(1999)
    expect(amountToCents(4.35)).toBe(435)
  })

  it('rounds extra decimals to the nearest cent', () => {
    expect(amountToCents(10.004)).toBe(1000)
    expect(amountToCents(10.006)).toBe(1001)
  })

  it('gives null for a missing or invalid value', () => {
    expect(amountToCents(null)).toBeNull()
    expect(amountToCents(undefined)).toBeNull()
    expect(amountToCents(Number.NaN)).toBeNull()
  })
})

describe('centsToAmount', () => {
  it('converts cents to an amount', () => {
    expect(centsToAmount(4990)).toBe(49.9)
    expect(centsToAmount(0)).toBe(0)
    expect(centsToAmount(5)).toBe(0.05)
  })

  it('gives 0 for a missing or invalid value', () => {
    expect(centsToAmount(null)).toBe(0)
    expect(centsToAmount(undefined)).toBe(0)
    expect(centsToAmount(Number.NaN)).toBe(0)
  })

  it('round-trips with amountToCents', () => {
    for (const cents of [0, 1, 10, 30, 999, 4990, 123456]) {
      expect(amountToCents(centsToAmount(cents))).toBe(cents)
    }
  })
})

describe('formatProductPrice', () => {
  it('formats cents as BRL', () => {
    expect(formatProductPrice(4990)).toMatch(/R\$\s*49,90/)
    expect(formatProductPrice(0)).toMatch(/R\$\s*0,00/)
  })

  it('passes options to formatCurrency', () => {
    expect(formatProductPrice(4900, { trailingZero: false })).toMatch(
      /R\$\s*49$/
    )
  })
})

describe('digitsToCents', () => {
  it('reads a masked price as cents', () => {
    expect(digitsToCents('R$ 50,90')).toBe(5090)
    expect(digitsToCents('R$ 1.234,56')).toBe(123456)
  })

  it('shifts a digit typed at the end in from the right', () => {
    expect(digitsToCents('R$ 50,901')).toBe(50901)
    expect(digitsToCents('R$ 0,005')).toBe(5)
  })

  it('drops the last digit on Backspace', () => {
    expect(digitsToCents('R$ 50,9')).toBe(509)
  })

  it('reads pasted text', () => {
    expect(digitsToCents('50,90')).toBe(5090)
  })

  it('gives 0 for zeros and null for no digit', () => {
    expect(digitsToCents('R$ 0,00')).toBe(0)
    expect(digitsToCents('')).toBeNull()
    expect(digitsToCents('R$ ')).toBeNull()
  })

  it('ignores digits after the 13th', () => {
    expect(digitsToCents('12345678901234')).toBe(1234567890123)
  })
})
