interface Options {
  currency?: 'USD' | 'BRL' | 'CAD'
  spaceBetween?: boolean
}

export function formatCurrency(
  value: number,
  options: Options = {
    currency: 'USD',
    spaceBetween: false,
  }
): string {
  return options?.spaceBetween === true
    ? addSpaceBetween(
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: options?.currency || 'USD',
          maximumSignificantDigits: 2,
        }).format(value ?? 0)
      )
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: options?.currency || 'USD',
        maximumSignificantDigits: 2,
      }).format(value ?? 0)
}

function addSpaceBetween(value: string) {
  return value.replace(/^(\D+)/, '$1 ').replace(/\s+/, ' ')
}
