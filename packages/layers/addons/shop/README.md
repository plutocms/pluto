# @plutocms/shop

**Docs:** [Shop](https://pluto.vulmix.dev/docs/layers/shop)

An add-on layer for [Pluto](https://pluto.vulmix.dev) shops, for every backend (Git CMS or
Supabase):

- **Cart:** `useCart()`, a cart saved in the browser (localStorage). It needs no database and no
  server route, so it works on a static site too.
- **Prices:** `formatProductPrice(cents)` and the helpers that convert between cents and an
  amount.

`@plutocms/supabase-shop` extends this layer, so a Supabase shop has it already.

## Install

```bash
npm install @plutocms/shop
```

Add it next to the backend layer of your app. It does not bring Pluto: the app or the backend
layer does.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['@plutocms/core', '@plutocms/shop'],
})
```

## The cart

```vue
<script setup lang="ts">
const props = defineProps<{ product: PublicProduct }>()
const { add, count, ready, quantityOf, limitOf } = useCart<PublicProduct>()

const full = computed(
  () => quantityOf(props.product.id) >= limitOf(props.product)
)
</script>

<template>
  <UButton :disabled="full" @click="add(product)">Add to cart</UButton>

  <NuxtLink to="/cart">Cart ({{ ready ? count : 0 }})</NuxtLink>
</template>
```

- `add(product, quantity?)`: adds units (default 1), up to the limit. It returns the units it
  added.
- `setQuantity(id, quantity)`, `remove(id)`, `clear()`.
- `lines`: each line has `id`, `quantity`, `product`, `subtotal` (cents) and `limit`.
- `count` (the units), `subtotal` (cents), `isEmpty`, `has(id)`, `quantityOf(id)`,
  `limitOf(product)`.
- `ready`: true in the browser once the saved cart is loaded. On the server the cart is empty.
  Show the count when `ready` is true, so the page does not flash a wrong number.
- `refresh()`: reads the products again from the public API. The cart does this once after each
  page load: the price and the stock are current, and a product that is gone or sold out leaves
  the cart. It returns the lines it removed and the lines it changed.

The cart is for the shopper's eyes. A checkout must compute the price again on the server.

### Settings

Change them in the `app.config.ts` of your app:

```ts [app/app.config.ts]
export default defineAppConfig({
  plutoShop: {
    cart: {
      type: 'product', // the public content type of the products
      storageKey: 'pluto-cart', // the localStorage key
      maxQuantity: 99, // the most units of one product
      stockField: 'stock', // a number field with the units in stock ('' = no limit)
      madeToOrderField: 'madeToOrder', // a boolean field: true = no stock limit
    },
  },
})
```

A product with no number in the stock field, or made to order, has no stock limit.
A product needs `id` and `price` (cents).

## Prices

Prices are integer cents (`4990` is R$ 49,90).

- `formatProductPrice(cents, options?)`: formats cents as a currency string. BRL by default; pass
  `{ currency: 'USD' }` for another one.
- `centsToAmount(cents)`: `4990` to `49.9`.
- `amountToCents(amount)`: `49.9` to `4990`, with rounding.
- `digitsToCents(text)`: the digits of a masked price input as cents (`'R$ 50,90'` to `5090`).
- `formatCurrency(amount, options?)`: formats an amount (not cents).
