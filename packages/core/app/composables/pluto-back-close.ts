import type { MaybeRefOrGetter, Ref } from 'vue'

const STATE_KEY = 'plutoBackClose'

let counter = 0

/**
 * Closes an overlay (a slideover, a side panel, the navigation menu) with the Back button or the
 * back swipe of a phone. While the overlay is open, the page has one more history entry, with the
 * same URL. Back removes that entry, and the overlay closes. The page stays where it is.
 *
 * - The entry keeps the state of Vue Router (`history.state` plus one key), so the router sees the
 *   same position on Back and changes nothing.
 * - A close from the overlay itself (its X, a click outside) goes back once, to remove the entry.
 * - A navigation from the overlay (a link) keeps the entry: the next page needs it as it is.
 *
 * `enabled` is true by default. Pass the narrow-screen rule, so a desktop panel adds no entry.
 * Call it in `setup`: it stops when the component unmounts.
 *
 * @see https://pluto.vulmix.dev/docs/extend/forms
 */
export function usePlutoBackClose(
  open: Ref<boolean>,
  enabled: MaybeRefOrGetter<boolean> = true
): void {
  if (import.meta.server) {
    return
  }

  const id = `pluto-${++counter}`
  let pushed = false

  function isOurs(state: unknown): boolean {
    return (
      typeof state === 'object' &&
      state !== null &&
      (state as Record<string, unknown>)[STATE_KEY] === id
    )
  }

  function onPopState(event: PopStateEvent) {
    if (pushed && !isOurs(event.state)) {
      pushed = false
      open.value = false
    }
  }

  watch(
    open,
    (value) => {
      if (value && !pushed && toValue(enabled)) {
        window.history.pushState(
          { ...(window.history.state ?? {}), [STATE_KEY]: id },
          ''
        )
        pushed = true
      } else if (!value && pushed) {
        pushed = false
        if (isOurs(window.history.state)) {
          window.history.back()
        }
      }
    },
    { flush: 'sync' }
  )

  const stopRouterHook = useRouter().beforeEach((to, from) => {
    if (to.fullPath !== from.fullPath) {
      pushed = false
    }
  })

  window.addEventListener('popstate', onPopState)
  onScopeDispose(() => {
    window.removeEventListener('popstate', onPopState)
    stopRouterHook()
  })
}
