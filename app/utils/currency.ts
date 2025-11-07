interface Options {
  currency?: 'USD' | 'BRL' | 'CAD'
  spaceBetween?: boolean
  prefix?: keyof Intl.NumberFormatOptionsCurrencyDisplayRegistry
  trailingZero?: boolean
}

/**
 * Formats a number as a currency string.
 * @param value - The numeric value to format.
 * @param options - Formatting options including currency type, spacing, prefix style, and trailing zero preference.
 * @returns The formatted currency string.
 */
export function formatCurrency(value: number, options?: Options): string {
  const {
    currency = 'USD',
    spaceBetween = true,
    prefix = 'symbol',
    trailingZero = true,
  } = options || {}

  const currencyLocaleMap: Record<string, string> = {
    USD: 'en-US',
    BRL: 'pt-BR',
    CAD: 'en-CA',
  }

  const formatter = new Intl.NumberFormat(currencyLocaleMap[currency], {
    style: 'currency',
    currency,
    currencyDisplay: prefix,
    minimumFractionDigits: trailingZero ? 2 : 0,
    maximumFractionDigits: 2,
  })

  let formattedValue = formatter.format(value)

  if (spaceBetween) {
    formattedValue = formattedValue.replace(/(\D)(\d)/, '$1 $2')
  }

  return formattedValue
}
