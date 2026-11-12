import type { Ref } from 'vue'

/**
 * Zen mode of the post editor: a button of the editor turns it on, and the panels around the text
 * close (the admin sidebar collapses, the left and the right panels of the form close). Off, the
 * panels that were open open again. A panel opened during Zen mode stays open. With
 * `hideToolbar` (kept in a cookie), the editor toolbar hides too while Zen mode is on. The state
 * lasts for the page: the form turns it off when it closes.
 */
export function usePlutoZen() {
  const active = useState<boolean>('pluto-zen', () => false)
  const hideToolbar = useCookie<boolean>('pluto-zen-toolbar', {
    default: () => false,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return { active, hideToolbar }
}

/**
 * Closes a panel while Zen mode is on, and opens it again after, if it was open. Also when the
 * component closes during Zen mode, so a closed state does not stay in the cookie of the panel.
 */
export function usePlutoZenPanel(open: Ref<boolean>) {
  const { active } = usePlutoZen()
  let wasOpen = false

  function enter() {
    wasOpen = open.value
    open.value = false
  }

  function leave() {
    if (wasOpen && !open.value) {
      open.value = true
    }
    wasOpen = false
  }

  if (active.value) {
    enter()
  }
  watch(active, (on) => (on ? enter() : leave()))
  onBeforeUnmount(() => {
    if (active.value) {
      leave()
    }
  })
}
