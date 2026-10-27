/** The content item on screen, for the "Edit <type>" button of the admin bar. */
export interface PlutoCurrentContent {
  /** The content type name, for example `post`. */
  type: string
  /** The item id, for example the slug of a post. */
  id: string
  /** The page that set the value. Only that page clears it. */
  owner: number
}

let nextOwner = 0

/**
 * The content item on screen, or `null`. `usePlutoEditLink` sets it in the
 * browser while the page is mounted. The admin bar reads it to show
 * "Edit <type>". The server never sets it.
 */
export function usePlutoCurrentContent() {
  return useState<PlutoCurrentContent | null>('pluto-current-content', () => null)
}

/**
 * Tells the admin bar which content item a public page shows, so the bar can
 * show "Edit <type>" (when the type sets `adminBar`). Returns the admin edit
 * path for a confirmed staff user with the `write` capability of the type,
 * else `null`. A visitor never gets a link, and the link is never in the
 * server HTML: the staff check runs in the browser.
 *
 * @param type The content type name, for example `post`.
 * @param id The item id. A ref or a getter follows the page.
 *
 * @example
 * const editLink = usePlutoEditLink('post', () => route.params.slug as string)
 */
export function usePlutoEditLink(type: string, id: MaybeRefOrGetter<string | number | null | undefined>) {
  const bar = usePlutoAdminBar()
  const current = usePlutoCurrentContent()
  const { byName } = usePlutoContentTypes()
  const { can } = usePlutoPermissions()

  if (import.meta.client) {
    // The next page can mount before this one unmounts. The owner check keeps
    // this page from clearing the value of the next page.
    const owner = ++nextOwner
    watch(
      () => toValue(id),
      (value) => {
        current.value = value === null || value === undefined || value === '' ? null : { type, id: String(value), owner }
      },
      { immediate: true }
    )
    onScopeDispose(() => {
      if (current.value?.owner === owner) {
        current.value = null
      }
    })
  }

  return computed(() => {
    const value = toValue(id)
    const contentType = byName(type)
    if (!bar.confirmed.value || value === null || value === undefined || value === '' || !contentType) {
      return null
    }
    // No capability declared means open to anyone who can reach the admin, like the form.
    if (contentType.capabilities?.write && !can(contentType.capabilities.write)) {
      return null
    }
    return contentTypeEditPath(contentType, value)
  })
}
