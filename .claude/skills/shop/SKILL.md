# Shop add-on

`@plutocms/shop` (`packages/layers/addons/shop`) is the add-on layer of the shops: the cart and
the price helpers, for every backend. Like `@plutocms/3d`, it does not extend core: the app or
its backend layer brings core, so core loads once. `@plutocms/supabase-shop` extends it, and the
minimalist Git CMS shop template will too.

## Files

- `nuxt.config.ts`: `$meta.name: 'shop'`, no `extends`.
- `app/app.config.ts`: the defaults of `plutoShop.cart` (see "Settings").
- `app/lib/cart.ts`: the pure rules, no Vue or Nuxt. Tested in `test/cart.test.ts`.
- `app/composables/cart.ts`: `useCart()`.
- `app/plugins/cart.client.ts`: loads, saves and syncs the cart in the browser.
- `shared/utils/currency.ts` and `shared/utils/product-price.ts`: the price helpers. They moved
  here from supabase-shop. Tested in `test/product-price.test.ts`.

## Cart

### State

- The lines are in `useState('pluto-shop-cart')`, and `ready` in
  `useState('pluto-shop-cart-ready')`. A line is `{ id, quantity, product }`. `product` is a copy
  of the product as the public API gave it, so the cart shows at once, with no call.
- On the server and until `onNuxtReady`, the cart is empty and `ready` is false. The plugin then
  reads localStorage. So the server HTML and the first client render match (no hydration
  mismatch). A UI shows the count only when `ready` is true.
- A line added before `onNuxtReady` (a fast click) stays, after the saved lines.
- The plugin saves each change (`watch` on the state; the helpers always give a new array, so the
  watch is not deep). It writes only a changed text.
- Other tabs follow through the `storage` event.
- localStorage can throw (a private window, blocked site data). The cart then lives for the page.

### Storage

- The key is `plutoShop.cart.storageKey` (default `pluto-cart`). A site under a sub path (GitHub
  Pages) adds `:<baseURL>`, so two sites on one origin keep two carts (`cartStorageKey`).
- The value is `{ version: 1, lines }` (`serializeCart`). `parseCart` gives no lines for a broken
  or unknown value, and leaves out a line that is not valid: an id that is not a string or a number,
  a quantity that is not a whole number above 0, a product without `price` or with another id,
  a second line of the same product.

### Limits

- `cartLimit(product, rules)`: `maxQuantity` (default 99), and the stock when
  `stockField` is set and the product has a number in it. No number (null): no stock limit. A
  product with `true` in `madeToOrderField`: no stock limit, whatever the stock field holds (a
  made-to-order product can have a stock of 0). A stock of 0 or less: 0, so `add` adds nothing.
- `add` clamps to the limit, and takes the new copy of the product. When the new copy has less
  stock than the line, the line goes down to it (0 removes it). It returns the units it added.
- `setQuantity` clamps too, rounds down, and 0 (or not a number) removes the line.
- Ids compare as strings (`sameCartId`): an id from the URL and an id from the API match.

### Refresh

- `refresh()` reads the products of the lines again (`loadCartProducts`), then
  `refreshCartLines` applies the answer to the lines of that moment, so a product added during
  the calls stays.
- A static build (`runtimeConfig.public.plutoPublicApi.static`) reads the public index
  (`PLUTO_PUBLIC_INDEX_PATH`) once. A live site reads
  `${PLUTO_API_PREFIX}/content/<type>/<id>` for each line, in parallel.
- A 404, or an id not in the index: the product is gone, and its line leaves the cart. Another
  failure (network, 5xx, no index): the line stays as it is.
- A product with a new price, or with less stock than the line, is in `changed`. A product that
  is gone or sold out is in `removed`. A UI can tell the shopper.
- The plugin runs `refresh()` once after the cart loads. A call while one runs gets the same
  promise. On the server, `refresh()` does nothing.
- The cart is for the shopper's eyes. A checkout computes the price on the server again.

### Settings

`plutoShop.cart` in app config, plain data, so an app or a backend layer changes it in its own
`app.config.ts`:

| Key                | Default        | Meaning                                                                  |
| ------------------ | -------------- | ------------------------------------------------------------------------ |
| `type`             | `'product'`    | The public content type of the products.                                 |
| `storageKey`       | `'pluto-cart'` | The localStorage key.                                                    |
| `maxQuantity`      | `99`           | The most units of one product.                                           |
| `stockField`       | `''`           | A number field with the units in stock. Empty: no limit.                 |
| `madeToOrderField` | `''`           | A boolean field, true when the product is made to order: no stock limit. |

supabase-shop sets `stockField: 'stock_quantity'` and `madeToOrderField: 'is_custom'`.

## Prices

Integer cents everywhere. `formatProductPrice(cents, options?)` (BRL by default),
`centsToAmount`, `amountToCents` (rounds after `toPrecision(15)`, so `1.005` gives `101` and
`0.1 + 0.2` gives `30`), `digitsToCents` (the digits of a masked input, at most 13), and
`formatCurrency(amount, options?)` (`currency`, `spaceBetween`, `prefix`, `trailingZero`). Do not
write `/ 100` or `* 100` anywhere else. `shared/utils`, so Nuxt auto-imports them in the app and
the server.
