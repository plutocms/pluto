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

/**
 * The default props of the Nuxt UI components in the admin. They live here, not
 * in `app.config`, because `app.config` is global: core's admin sizes would
 * reach every public site, and a site's sizes would reach the admin.
 * `PlutoAdminTheme` gives them to the admin with `UTheme`.
 */
export const PLUTO_ADMIN_UI_PROPS = {
  button: { size: 'xl' },
  input: { size: 'xl' },
  formField: { size: 'xl' },
} as const

/**
 * The slot classes of the Nuxt UI components in the admin. `font-sans` is the
 * admin font (admin-theme.css sets `--font-sans` under the admin selectors).
 * It comes after the `app.config` classes of the site, so a site's
 * `ui.button.slots.base: 'font-outfit'` does not reach the admin buttons.
 */
export const PLUTO_ADMIN_UI = {
  button: { base: 'font-sans' },
  badge: { base: 'font-sans' },
  input: { root: 'w-full', base: 'font-sans' },
  textarea: { base: 'font-sans' },
  select: { base: 'font-sans' },
  selectMenu: { base: 'font-sans' },
  inputMenu: { base: 'font-sans' },
} as const
