export default defineAppConfig({
  plutoShop: {
    /**
     * The settings of the cart.
     *
     * @see https://pluto.vulmix.dev/docs/layers/shop#settings
     */
    cart: {
      /**
       * The public content type of the products. The cart reads them again from
       * `/api/pluto/v1/content/<type>/<id>` (or the public index of a static site).
       */
      type: 'product',
      /** The localStorage key. A site under a sub path adds the path. */
      storageKey: 'pluto-cart',
      /** The most units of one product in the cart. */
      maxQuantity: 99,
      /**
       * A number field of the product with the units in stock: the cart takes no more. Empty, or
       * a product without a number in it (made to order): no stock limit.
       */
      stockField: '',
      /**
       * A boolean field of the product, true when it is made to order: then no stock limit. Empty:
       * no such field.
       */
      madeToOrderField: '',
    },
  },
})
