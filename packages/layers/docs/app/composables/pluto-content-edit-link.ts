/**
 * The admin edit link of a Nuxt Content page, for the signed-in staff only.
 * Returns `null` for a visitor, so a public page shows no link. The link is
 * `/admin/content/<type>/<id>`. The id is the page stem (`2.core/03.content-model`).
 * The staff check runs in the browser, so the link appears after hydration,
 * never in the server HTML.
 *
 * It also tells the admin bar which page is on screen, so the bar shows
 * "Edit page" for it. It is a wrapper of core's `usePlutoEditLink`.
 *
 * @param page A Nuxt Content page. Only `stem` is read.
 * @param type The content type name. Default `doc`.
 */
export function usePlutoContentEditLink(
  page: MaybeRefOrGetter<{ stem?: string } | null | undefined>,
  type = 'doc'
) {
  return usePlutoEditLink(type, () => toValue(page)?.stem)
}
