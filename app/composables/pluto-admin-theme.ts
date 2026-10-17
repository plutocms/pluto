/**
 * Puts `data-pluto-admin` on <html> while the calling component is mounted.
 * `app/assets/css/admin-theme.css` keys the admin's own palette, chart
 * colors, surfaces, and font on that attribute, so the consumer app's
 * public-site theme (its app.config colors and @theme) does not reach the
 * admin. The attribute sits on <html>, not on a layout wrapper, so it also
 * covers overlays that render at the end of <body>.
 *
 * Call it from every admin layout. `useHead` removes the attribute when the
 * layout unmounts, so the public site never gets it.
 */
export function usePlutoAdminTheme() {
  useHead({ htmlAttrs: { 'data-pluto-admin': '' } })
}
