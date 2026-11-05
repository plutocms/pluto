// The pure rules of the cart: no Vue, no Nuxt, no storage. `useCart` (app/composables/cart.ts)
// keeps the lines in state and calls these. Tests: test/cart.test.ts.

/** The fields the cart reads from a product. The public API gives more. */
export interface PlutoCartProduct {
  id: string | number
  /** The price of one unit, in cents. */
  price: number
  [field: string]: unknown
}

/** One product in the cart. `product` is a copy, from the last time the cart read it. */
export interface PlutoCartLine<T extends PlutoCartProduct = PlutoCartProduct> {
  id: string | number
  quantity: number
  product: T
}

/** The settings of the cart (`plutoShop.cart` in app config). */
export interface PlutoCartRules {
  /** The most units of one product in the cart. */
  maxQuantity: number
  /**
   * A number field of the product: the units in stock. The cart takes no more than that. An
   * empty name, or a product without a number in the field, has no stock limit.
   */
  stockField: string
  /**
   * A boolean field of the product: true when it is made to order. Such a product has no stock
   * limit, whatever its stock field holds. Empty: no such field.
   */
  madeToOrderField: string
}

/** The text that localStorage holds. `version` lets a later format read an old cart. */
export interface PlutoCartStored {
  version: 1
  lines: PlutoCartLine[]
}

/** The same id, for an id from the URL (a string) and an id from the API (a number). */
export function sameCartId(a: string | number, b: string | number): boolean {
  return String(a) === String(b)
}

/**
 * The most units of `product` that the cart takes: the stock, and never more than `maxQuantity`.
 * A product made to order has no stock limit.
 */
export function cartLimit(
  product: PlutoCartProduct,
  rules: PlutoCartRules
): number {
  const max = Math.max(0, Math.floor(rules.maxQuantity))
  if (rules.madeToOrderField && product[rules.madeToOrderField] === true) {
    return max
  }
  const stock = rules.stockField ? product[rules.stockField] : undefined
  if (typeof stock !== 'number' || !Number.isFinite(stock)) {
    return max
  }
  return Math.min(max, Math.max(0, Math.floor(stock)))
}

/** A whole number from 0 to `limit`. Anything else that is not a number gives 0. */
function clampQuantity(quantity: number, limit: number): number {
  if (!Number.isFinite(quantity)) {
    return 0
  }
  return Math.min(limit, Math.max(0, Math.floor(quantity)))
}

/**
 * Adds `quantity` units of `product`, up to its limit. A product in the cart gets the new copy,
 * and its units go down to the new limit when the stock is now lower. Returns the new lines and
 * the units really added (0 when the product is at its limit).
 */
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

/** Sets the units of one product, up to its limit. 0 or less removes the product. */
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

/** The lines without the product `id`. */
export function removeCartLine<T extends PlutoCartProduct>(
  lines: PlutoCartLine<T>[],
  id: string | number
): PlutoCartLine<T>[] {
  return lines.filter((line) => !sameCartId(line.id, id))
}

/** The units of all products. */
export function cartCount(lines: PlutoCartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

/** The price of one line, in cents. */
export function cartLineSubtotal(line: PlutoCartLine): number {
  const price = Number(line.product.price)
  return Number.isFinite(price) ? price * line.quantity : 0
}

/** The price of all lines, in cents. */
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

/**
 * The lines of a saved cart. A text that is not a cart gives no lines, and a line that is not
 * valid is left out, so a broken or old value never breaks the page.
 */
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

/** The text to save in localStorage. */
export function serializeCart(lines: PlutoCartLine[]): string {
  const stored: PlutoCartStored = { version: 1, lines }
  return JSON.stringify(stored)
}

/**
 * The lines with the current products. `fresh` maps an id to the product as the API gives it
 * now, or `null` when the API no longer has it. An id that is not in `fresh` (the call failed)
 * keeps its line as it is. A product that is gone, or out of stock, leaves the cart; a quantity
 * over the new limit goes down to it.
 */
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

/** How `loadCartProducts` reads the public API. */
export interface PlutoCartSource {
  /** The public content type of the products. */
  type: string
  /** A static build: read the public index, not the item routes. */
  static: boolean
  /** The path of the public index (`PLUTO_PUBLIC_INDEX_PATH`). */
  indexPath: string
  /** The path of one item (`/api/pluto/v1/content/<type>/<id>`). */
  itemPath: (id: string | number) => string
  /** `$fetch`, or a stub in a test. */
  fetch: <R>(path: string) => Promise<R>
}

function isNotFound(error: unknown): boolean {
  const status = error as { statusCode?: number; status?: number } | null
  return status?.statusCode === 404 || status?.status === 404
}

/**
 * The current products of `ids`, for `refreshCartLines`: a product, or `null` when the API no
 * longer has it (404, or not in the index). An id whose call failed in another way is not in the
 * map, so its line stays. A static site reads the index once; a live site reads each item, in
 * parallel.
 */
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

/**
 * The localStorage key of the cart. A site under a sub path (GitHub Pages) adds the path, so
 * two sites on one origin keep two carts.
 */
export function cartStorageKey(storageKey: string, baseURL: string): string {
  return baseURL && baseURL !== '/' ? `${storageKey}:${baseURL}` : storageKey
}
