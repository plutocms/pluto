// No index signature: an app interface such as `PublicProduct` must fit.
export interface PlutoCartProduct {
  id: string | number
  price: number
}

export interface PlutoCartLine<T extends PlutoCartProduct = PlutoCartProduct> {
  id: string | number
  quantity: number
  product: T
}

export interface PlutoCartRules {
  maxQuantity: number
  stockField: string
  madeToOrderField: string
}

export interface PlutoCartStored {
  version: 1
  lines: PlutoCartLine[]
}

export function sameCartId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

export function cartLimit(
  product: PlutoCartProduct,
  rules: PlutoCartRules
): number {
  const max = Math.max(0, Math.floor(rules.maxQuantity))
  const fields = product as unknown as Record<string, unknown>
  if (rules.madeToOrderField && fields[rules.madeToOrderField] === true) {
    return max
  }
  const stock = rules.stockField ? fields[rules.stockField] : undefined
  if (typeof stock !== 'number' || !Number.isFinite(stock)) {
    return max
  }
  return Math.min(max, Math.max(0, Math.floor(stock)))
}

function clampQuantity(quantity: number, limit: number): number {
  if (!Number.isFinite(quantity)) {
    return 0
  }
  return Math.min(limit, Math.max(0, Math.floor(quantity)))
}

export function addCartLine<T extends PlutoCartProduct>(
  lines: PlutoCartLine<T>[],
  product: T,
  quantity: number,
  rules: PlutoCartRules
): { lines: PlutoCartLine<T>[]; added: number } {
  const index = lines.findIndex((line) => sameCartId(line.id, product.id))
  const current = index === -1 ? 0 : lines[index]!.quantity
  const next = clampQuantity(
    current + Math.max(0, quantity),
    cartLimit(product, rules)
  )
  const added = Math.max(0, next - current)
  const line = { id: product.id, quantity: next, product }
  if (index === -1) {
    return { lines: next > 0 ? [...lines, line] : lines, added }
  }
  return {
    lines: next > 0 ? lines.with(index, line) : lines.toSpliced(index, 1),
    added,
  }
}

export function setCartLineQuantity<T extends PlutoCartProduct>(
  lines: PlutoCartLine<T>[],
  id: string | number,
  quantity: number,
  rules: PlutoCartRules
): PlutoCartLine<T>[] {
  return lines.flatMap((line) => {
    if (!sameCartId(line.id, id)) {
      return [line]
    }
    const next = clampQuantity(quantity, cartLimit(line.product, rules))
    return next > 0 ? [{ ...line, quantity: next }] : []
  })
}

export function removeCartLine<T extends PlutoCartProduct>(
  lines: PlutoCartLine<T>[],
  id: string | number
): PlutoCartLine<T>[] {
  return lines.filter((line) => !sameCartId(line.id, id))
}

export function cartCount(lines: PlutoCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export function cartLineSubtotal(line: PlutoCartLine): number {
  const price = Number(line.product.price)
  return Number.isFinite(price) ? price * line.quantity : 0
}

export function cartSubtotal(lines: PlutoCartLine[]): number {
  return lines.reduce((sum, line) => sum + cartLineSubtotal(line), 0)
}

function isCartLine(value: unknown): value is PlutoCartLine {
  if (!value || typeof value !== 'object') {
    return false
  }
  const line = value as Record<string, unknown>
  const product = line.product as Record<string, unknown> | null | undefined
  return (
    (typeof line.id === 'string' || typeof line.id === 'number') &&
    typeof line.quantity === 'number' &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    !!product &&
    typeof product === 'object' &&
    sameCartId(product.id as string | number, line.id) &&
    typeof product.price === 'number'
  )
}

export function parseCart(text: string | null | undefined): PlutoCartLine[] {
  if (!text) {
    return []
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return []
  }
  const stored = value as Partial<PlutoCartStored> | null
  if (!stored || stored.version !== 1 || !Array.isArray(stored.lines)) {
    return []
  }
  const lines: PlutoCartLine[] = []
  for (const line of stored.lines) {
    if (
      isCartLine(line) &&
      !lines.some((other) => sameCartId(other.id, line.id))
    ) {
      lines.push(line)
    }
  }
  return lines
}

export function serializeCart(lines: PlutoCartLine[]): string {
  const stored: PlutoCartStored = { version: 1, lines }
  return JSON.stringify(stored)
}

export function refreshCartLines<T extends PlutoCartProduct>(
  lines: PlutoCartLine<T>[],
  fresh: Map<string, T | null>,
  rules: PlutoCartRules
): {
  lines: PlutoCartLine<T>[]
  removed: PlutoCartLine<T>[]
  changed: PlutoCartLine<T>[]
} {
  const result: PlutoCartLine<T>[] = []
  const removed: PlutoCartLine<T>[] = []
  const changed: PlutoCartLine<T>[] = []
  for (const line of lines) {
    const key = String(line.id)
    if (!fresh.has(key)) {
      result.push(line)
      continue
    }
    const product = fresh.get(key)
    if (!product) {
      removed.push(line)
      continue
    }
    const quantity = clampQuantity(line.quantity, cartLimit(product, rules))
    if (quantity === 0) {
      removed.push(line)
      continue
    }
    const next = { id: line.id, quantity, product }
    if (quantity !== line.quantity || product.price !== line.product.price) {
      changed.push(next)
    }
    result.push(next)
  }
  return { lines: result, removed, changed }
}

export interface PlutoCartSource {
  type: string
  static: boolean
  indexPath: string
  itemPath: (id: string | number) => string
  fetch: <R>(path: string) => Promise<R>
}

function isNotFound(error: unknown): boolean {
  const status = error as { statusCode?: number; status?: number } | null
  return status?.statusCode === 404 || status?.status === 404
}

export async function loadCartProducts<T extends PlutoCartProduct>(
  ids: (string | number)[],
  source: PlutoCartSource
): Promise<Map<string, T | null>> {
  const result = new Map<string, T | null>()
  if (source.static) {
    const index = await source
      .fetch<{ types?: Record<string, { items?: T[] }> }>(source.indexPath)
      .catch(() => null)
    const items = index?.types?.[source.type]?.items
    if (!items) {
      return result
    }
    for (const id of ids) {
      result.set(
        String(id),
        items.find((item) => sameCartId(item.id, id)) ?? null
      )
    }
    return result
  }
  const answers = await Promise.allSettled(
    ids.map((id) => source.fetch<{ data: T }>(source.itemPath(id)))
  )
  answers.forEach((answer, index) => {
    const key = String(ids[index])
    if (answer.status === 'fulfilled') {
      result.set(key, answer.value.data)
    } else if (isNotFound(answer.reason)) {
      result.set(key, null)
    }
  })
  return result
}

export function cartStorageKey(storageKey: string, baseURL: string): string {
  return baseURL && baseURL !== '/' ? `${storageKey}:${baseURL}` : storageKey
}
