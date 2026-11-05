import type {
  PlutoCartLine,
  PlutoCartProduct,
  PlutoCartRules,
} from '../lib/cart'
import {
  addCartLine,
  cartCount,
  cartLimit,
  cartLineSubtotal,
  cartSubtotal,
  loadCartProducts,
  refreshCartLines,
  removeCartLine,
  sameCartId,
  setCartLineQuantity,
} from '../lib/cart'

// The cart of a shop. The lines are in `useState`, and the browser saves them in localStorage
// (app/plugins/cart.client.ts). See the shop skill ("Cart").

/** A line of `useCart().lines`: the product, its units, its price and its limit. */
export interface PlutoCartItem<
  T extends PlutoCartProduct = PlutoCartProduct,
> extends PlutoCartLine<T> {
  /** The price of the units, in cents. */
  subtotal: number
  /** The most units the cart takes (the stock, and `maxQuantity`). */
  limit: number
}

/** The answer of `refresh()`: the lines it removed, and the lines with a new quantity or price. */
export interface PlutoCartRefresh<
  T extends PlutoCartProduct = PlutoCartProduct,
> {
  removed: PlutoCartLine<T>[]
  changed: PlutoCartLine<T>[]
}

/** The state key of the lines. */
export const PLUTO_CART_STATE = 'pluto-shop-cart'

let pendingRefresh: Promise<PlutoCartRefresh> | undefined

// `$fetch` with a plain type. Through `unknown`: a call with a `string` path compares it with
// every typed server route of the app, and TypeScript stops with "excessive stack depth" in an
// app with many routes (a Supabase shop).
function fetchJson<R>(path: string): Promise<R> {
  return ($fetch as unknown as (path: string) => Promise<R>)(path)
}

/**
 * The cart. The same lines in every component, saved in the browser (localStorage). On the
 * server and until the page hydrates, the cart is empty and `ready` is false: show the count
 * when `ready` is true, so the server HTML and the first render match.
 *
 * After the page loads, the cart reads its products again from the public API: the price and
 * the stock are current, and a product that is gone or sold out leaves the cart. A checkout
 * must still compute the price on the server.
 *
 * @example
 * const cart = useCart<PublicProduct>()
 * cart.add(product)
 * cart.count.value // 1
 */
export function useCart<T extends PlutoCartProduct = PlutoCartProduct>() {
  const settings = useAppConfig().plutoShop.cart
  const runtime = useRuntimeConfig().public
  const state = useState<PlutoCartLine<T>[]>(PLUTO_CART_STATE, () => [])
  const ready = useState<boolean>(`${PLUTO_CART_STATE}-ready`, () => false)

  const rules = (): PlutoCartRules => ({
    maxQuantity: settings.maxQuantity,
    stockField: settings.stockField,
    madeToOrderField: settings.madeToOrderField,
  })

  const lines = computed<PlutoCartItem<T>[]>(() =>
    state.value.map((line) => ({
      ...line,
      subtotal: cartLineSubtotal(line),
      limit: cartLimit(line.product, rules()),
    }))
  )

  function find(id: string | number) {
    return state.value.find((line) => sameCartId(line.id, id))
  }

  /** Adds units of a product (default 1), up to its limit. Returns the units really added. */
  function add(product: T, quantity = 1): number {
    const result = addCartLine(state.value, product, quantity, rules())
    state.value = result.lines
    return result.added
  }

  /** Sets the units of a product, up to its limit. 0 removes it. */
  function setQuantity(id: string | number, quantity: number) {
    state.value = setCartLineQuantity(state.value, id, quantity, rules())
  }

  function remove(id: string | number) {
    state.value = removeCartLine(state.value, id)
  }

  function clear() {
    state.value = []
  }

  /**
   * Reads the products of the cart again from the public API (the public index on a static
   * site). Runs once after the page loads; call it again before a checkout. A call while one runs
   * gets the same answer.
   */
  function refresh(): Promise<PlutoCartRefresh<T>> {
    if (import.meta.server || state.value.length === 0) {
      return Promise.resolve({ removed: [], changed: [] })
    }
    pendingRefresh ??= loadCartProducts<T>(
      state.value.map((line) => line.id),
      {
        type: settings.type,
        static: runtime.plutoPublicApi.static,
        indexPath: PLUTO_PUBLIC_INDEX_PATH,
        itemPath: (id) =>
          `${PLUTO_API_PREFIX}/content/${settings.type}/${encodeURIComponent(id)}`,
        fetch: fetchJson,
      }
    )
      .then((fresh) => {
        // The lines of now, not of the start: a product added during the calls stays.
        const result = refreshCartLines(state.value, fresh, rules())
        state.value = result.lines
        return { removed: result.removed, changed: result.changed }
      })
      .finally(() => {
        pendingRefresh = undefined
      })
    return pendingRefresh as Promise<PlutoCartRefresh<T>>
  }

  return {
    /** The lines, in the order the shopper added them. */
    lines,
    /** The units of all products. */
    count: computed(() => cartCount(state.value)),
    /** The price of all lines, in cents. Show it with `formatProductPrice`. */
    subtotal: computed(() => cartSubtotal(state.value)),
    isEmpty: computed(() => state.value.length === 0),
    /** True in the browser once the saved cart is loaded. */
    ready: readonly(ready),
    add,
    setQuantity,
    remove,
    clear,
    refresh,
    has: (id: string | number) => !!find(id),
    /** The units of a product in the cart (0 when it is not in the cart). */
    quantityOf: (id: string | number) => find(id)?.quantity ?? 0,
    /** The most units of a product the cart takes. 0: sold out. */
    limitOf: (product: T) => cartLimit(product, rules()),
  }
}
