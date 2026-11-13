import { formatCurrency } from './currency'

// Prices are integer cents. Convert only with these helpers: do not write `/ 100` or `* 100` elsewhere.

type FormatCurrencyOptions = NonNullable<Parameters<typeof formatCurrency>[1]>

/**
 * Converts integer cents to a currency amount. Example: 4990 -> 49.9.
 * A missing or invalid value gives 0.
 *
 * @see https://pluto.vulmix.dev/docs/layers/shop#prices
 */
export function centsToAmount(cents: number | null | undefined): number {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    return 0
  }
  return cents / 100
}

/**
 * Converts a currency amount to integer cents. Example: 49.9 -> 4990.
 * The result is rounded, so a float error like 0.1 + 0.2 gives exactly 30.
 * A missing or invalid value gives null.
 *
 * @see https://pluto.vulmix.dev/docs/layers/shop#prices
 */
export function amountToCents(
  amount: number | null | undefined
): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null
  }
  // `toPrecision(15)` removes the float noise before the rounding.
  // Without it, 1.005 * 100 is 100.49999999999999 and rounds down.
  return Math.round(Number((amount * 100).toPrecision(15)))
}

const MAX_PRICE_DIGITS = 13

/**
 * Reads the digits of a masked price text as integer cents. Example: "R$ 50,90" -> 5090,
 * and "R$ 50,901" (one digit typed at the end) -> 50901. Digits after the 13th are ignored.
 * A text with no digit gives null.
 *
 * @see https://pluto.vulmix.dev/docs/layers/shop#prices
 */
export function digitsToCents(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  if (digits === '') {
    return null
  }
  return Number(digits.replace(/^0+(?=\d)/, '').slice(0, MAX_PRICE_DIGITS))
}

/**
 * Formats a product price in cents as a currency string (BRL by default).
 * Example: 4990 -> "R$ 49,90".
 *
 * @see https://pluto.vulmix.dev/docs/layers/shop#prices
 */
export function formatProductPrice(
  cents: number | null | undefined,
  options?: FormatCurrencyOptions
): string {
  return formatCurrency(centsToAmount(cents), { currency: 'BRL', ...options })
}
