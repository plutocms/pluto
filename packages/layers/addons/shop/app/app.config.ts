// The settings of the shop layer. An app or a backend layer changes them in its own
// app.config.ts; Nuxt merges the objects. See the shop skill ("Cart").
export default defineAppConfig({
  plutoShop: {
    cart: {
      // The public content type of the products: the cart reads them again from
      // `/api/pluto/v1/content/<type>/<id>` (or the public index of a static site).
      type: 'product',
      // The localStorage key. A site under a sub path adds the path.
      storageKey: 'pluto-cart',
      // The most units of one product in the cart.
      maxQuantity: 99,
      // A number field of the product with the units in stock: the cart takes no more. Empty, or
      // a product without a number in it (made to order): no stock limit.
      stockField: '',
      // A boolean field of the product, true when it is made to order: then no stock limit. Empty:
      // no such field.
      madeToOrderField: '',
    },
  },
})
