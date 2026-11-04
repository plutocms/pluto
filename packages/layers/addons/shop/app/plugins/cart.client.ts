import type { PlutoCartLine } from '../lib/cart'
import {
  cartStorageKey,
  parseCart,
  sameCartId,
  serializeCart,
} from '../lib/cart'

// Loads the saved cart after hydration, saves each change, and follows the other tabs. Before
// `onNuxtReady` the cart is empty, as on the server, so the first render matches the HTML.
export default defineNuxtPlugin({
  name: 'pluto-shop-cart',
  setup() {
    const cart = useCart()
    const state = useState<PlutoCartLine[]>(PLUTO_CART_STATE)
    const ready = useState<boolean>(`${PLUTO_CART_STATE}-ready`)
    const key = cartStorageKey(
      useAppConfig().plutoShop.cart.storageKey,
      useRuntimeConfig().app.baseURL
    )

    // localStorage throws in some private windows and with blocked site data. The cart then
    // lives for the page only.
    function read(): string | null {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    }
    function write(text: string) {
      try {
        if (localStorage.getItem(key) !== text) {
          localStorage.setItem(key, text)
        }
      } catch {}
    }

    onNuxtReady(() => {
      // A product added before this point (a fast click) stays, after the saved lines.
      const early = state.value
      const saved = parseCart(read()).filter(
        (line) => !early.some((other) => sameCartId(other.id, line.id))
      )
      watch(state, (lines) => write(serializeCart(lines)))
      state.value = [...saved, ...early]
      ready.value = true

      window.addEventListener('storage', (event) => {
        if (event.key === key) {
          state.value = parseCart(event.newValue)
        }
      })

      cart.refresh().catch(() => {})
    })
  },
})
