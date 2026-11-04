import type {
  PlutoCartLine,
  PlutoCartProduct,
  PlutoCartRules,
  PlutoCartSource,
} from '../app/lib/cart'
import { describe, expect, it } from 'vitest'
import {
  addCartLine,
  cartCount,
  cartLimit,
  cartStorageKey,
  cartSubtotal,
  loadCartProducts,
  parseCart,
  refreshCartLines,
  removeCartLine,
  serializeCart,
  setCartLineQuantity,
} from '../app/lib/cart'

interface Product extends PlutoCartProduct {
  name: string
  stock_quantity: number | null
  is_custom?: boolean
}

const rules: PlutoCartRules = {
  maxQuantity: 99,
  stockField: 'stock_quantity',
  madeToOrderField: 'is_custom',
}

function product(id: number, fields: Partial<Product> = {}): Product {
  return { id, name: `P${id}`, price: 1000, stock_quantity: 5, ...fields }
}

describe('cartLimit', () => {
  it('is the stock, and never more than maxQuantity', () => {
    expect(cartLimit(product(1), rules)).toBe(5)
    expect(cartLimit(product(1, { stock_quantity: 500 }), rules)).toBe(99)
    expect(cartLimit(product(1, { stock_quantity: 0 }), rules)).toBe(0)
    expect(cartLimit(product(1, { stock_quantity: -3 }), rules)).toBe(0)
  })

  it('has no stock limit for a product without a number, or without a stock field', () => {
    expect(cartLimit(product(1, { stock_quantity: null }), rules)).toBe(99)
    expect(
      cartLimit(product(1), {
        maxQuantity: 10,
        stockField: '',
        madeToOrderField: '',
      })
    ).toBe(10)
  })

  it('has no stock limit for a product made to order, whatever its stock', () => {
    expect(
      cartLimit(product(1, { is_custom: true, stock_quantity: 0 }), rules)
    ).toBe(99)
    expect(
      cartLimit(product(1, { is_custom: false, stock_quantity: 0 }), rules)
    ).toBe(0)
  })
})

describe('addCartLine', () => {
  it('adds a product, then more units of it, up to the stock', () => {
    let result = addCartLine<Product>([], product(1), 1, rules)
    expect(result.added).toBe(1)
    expect(result.lines).toHaveLength(1)

    result = addCartLine(result.lines, product(1), 3, rules)
    expect(result.added).toBe(3)
    expect(result.lines[0]!.quantity).toBe(4)

    result = addCartLine(result.lines, product(1), 3, rules)
    expect(result.added).toBe(1)
    expect(result.lines[0]!.quantity).toBe(5)
  })

  it('adds nothing for a sold out product', () => {
    const result = addCartLine<Product>(
      [],
      product(1, { stock_quantity: 0 }),
      1,
      rules
    )
    expect(result).toEqual({ lines: [], added: 0 })
  })

  it('keeps the new copy of the product, and goes down to a lower stock', () => {
    const lines = addCartLine<Product>([], product(1), 5, rules).lines
    const result = addCartLine(
      lines,
      product(1, { price: 1200, stock_quantity: 2 }),
      1,
      rules
    )
    expect(result.added).toBe(0)
    expect(result.lines[0]).toMatchObject({
      quantity: 2,
      product: { price: 1200 },
    })
  })

  it('finds a line by the same id as a string or a number', () => {
    const lines = addCartLine<Product>([], product(1), 1, rules).lines
    const result = addCartLine(lines, { ...product(1), id: '1' }, 1, rules)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]!.quantity).toBe(2)
  })
})

describe('setCartLineQuantity and removeCartLine', () => {
  const lines = [
    { id: 1, quantity: 2, product: product(1) },
    { id: 2, quantity: 1, product: product(2) },
  ]

  it('sets the units, up to the limit, and 0 removes the line', () => {
    expect(setCartLineQuantity(lines, 1, 4, rules)[0]!.quantity).toBe(4)
    expect(setCartLineQuantity(lines, 1, 40, rules)[0]!.quantity).toBe(5)
    expect(setCartLineQuantity(lines, '1', 2.7, rules)[0]!.quantity).toBe(2)
    expect(
      setCartLineQuantity(lines, 1, 0, rules).map((line) => line.id)
    ).toEqual([2])
    expect(
      setCartLineQuantity(lines, 1, Number.NaN, rules).map((line) => line.id)
    ).toEqual([2])
  })

  it('removes a line', () => {
    expect(removeCartLine(lines, 2).map((line) => line.id)).toEqual([1])
  })

  it('counts the units and the price', () => {
    expect(cartCount(lines)).toBe(3)
    expect(cartSubtotal(lines)).toBe(3000)
  })
})

describe('parseCart and serializeCart', () => {
  it('reads what it writes', () => {
    const lines = [{ id: 1, quantity: 2, product: product(1) }]
    expect(parseCart(serializeCart(lines))).toEqual(lines)
  })

  it('gives no lines for a missing, broken or unknown value', () => {
    expect(parseCart(null)).toEqual([])
    expect(parseCart('{')).toEqual([])
    expect(parseCart('[]')).toEqual([])
    expect(parseCart(JSON.stringify({ version: 2, lines: [] }))).toEqual([])
  })

  it('leaves out a line that is not valid, and a second line of one product', () => {
    const good = { id: 1, quantity: 1, product: product(1) }
    const text = JSON.stringify({
      version: 1,
      lines: [
        good,
        { id: 2, quantity: 0, product: product(2) },
        { id: 3, quantity: 1.5, product: product(3) },
        { id: 4, quantity: 1, product: product(5) },
        { id: 6, quantity: 1, product: { id: 6 } },
        { id: 7, quantity: 1 },
        { ...good, quantity: 3 },
      ],
    })
    expect(parseCart(text)).toEqual([good])
  })
})

describe('refreshCartLines', () => {
  const lines: PlutoCartLine<Product>[] = [
    { id: 1, quantity: 2, product: product(1) },
    { id: 2, quantity: 4, product: product(2) },
    { id: 3, quantity: 1, product: product(3) },
    { id: 4, quantity: 1, product: product(4) },
    { id: 5, quantity: 1, product: product(5) },
  ]

  it('takes the current products, removes the gone and sold out ones, and keeps a failed one', () => {
    const fresh = new Map<string, Product | null>([
      ['1', product(1, { price: 1500 })],
      ['2', product(2, { stock_quantity: 3 })],
      ['3', null],
      ['4', product(4, { stock_quantity: 0 })],
    ])
    const result = refreshCartLines(lines, fresh, rules)
    expect(
      result.lines.map((line) => [line.id, line.quantity, line.product.price])
    ).toEqual([
      [1, 2, 1500],
      [2, 3, 1000],
      [5, 1, 1000],
    ])
    expect(result.removed.map((line) => line.id)).toEqual([3, 4])
    expect(result.changed.map((line) => line.id)).toEqual([1, 2])
  })
})

describe('loadCartProducts', () => {
  function source(
    fields: Partial<PlutoCartSource>,
    answers: Record<string, unknown>
  ): PlutoCartSource {
    return {
      type: 'product',
      static: false,
      indexPath: '/api/pluto/v1/index.json',
      itemPath: (id) => `/api/pluto/v1/content/product/${id}`,
      fetch: async <R>(path: string) => {
        const answer = answers[path]
        if (answer instanceof Error) {
          throw answer
        }
        if (answer === undefined) {
          throw Object.assign(new Error('Not found'), { statusCode: 404 })
        }
        return answer as R
      },
      ...fields,
    }
  }

  it('reads each item on a live site: 404 is gone, another failure keeps the line', async () => {
    const result = await loadCartProducts<Product>(
      [1, 2, 3],
      source(
        {},
        {
          '/api/pluto/v1/content/product/1': { data: product(1) },
          '/api/pluto/v1/content/product/3': Object.assign(new Error('Down'), {
            statusCode: 502,
          }),
        }
      )
    )
    expect([...result.entries()]).toEqual([
      ['1', product(1)],
      ['2', null],
    ])
  })

  it('reads the public index once on a static site', async () => {
    const result = await loadCartProducts<Product>(
      [1, '2'],
      source(
        { static: true },
        {
          '/api/pluto/v1/index.json': {
            types: { product: { titleField: 'name', items: [product(1)] } },
          },
        }
      )
    )
    expect([...result.entries()]).toEqual([
      ['1', product(1)],
      ['2', null],
    ])
  })

  it('keeps every line when the index does not load or has no such type', async () => {
    expect(
      (await loadCartProducts([1], source({ static: true }, {}))).size
    ).toBe(0)
    const other = source(
      { static: true },
      { '/api/pluto/v1/index.json': { types: {} } }
    )
    expect((await loadCartProducts([1], other)).size).toBe(0)
  })
})

describe('cartStorageKey', () => {
  it('adds the base URL of a site under a sub path', () => {
    expect(cartStorageKey('pluto-cart', '/')).toBe('pluto-cart')
    expect(cartStorageKey('pluto-cart', '/templates/shop/')).toBe(
      'pluto-cart:/templates/shop/'
    )
  })
})
