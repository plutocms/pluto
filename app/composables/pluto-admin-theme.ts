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
 * The default props of the Nuxt UI components in the admin: the default size
 * of Nuxt UI (`md`) for every component that has a size. They live here, not
 * in `app.config`, because `app.config` is global: a site's
 * `ui.button.defaultVariants.size` would reach the admin, and admin sizes
 * would reach every public site. A prop that a component sets itself wins.
 * `PlutoAdminTheme` gives them to the admin with `UTheme`.
 */
export const PLUTO_ADMIN_UI_PROPS = {
  avatar: { size: 'md' },
  avatarGroup: { size: 'md' },
  badge: { size: 'md' },
  button: { size: 'md' },
  calendar: { size: 'md' },
  checkbox: { size: 'md' },
  checkboxGroup: { size: 'md' },
  chip: { size: 'md' },
  colorPicker: { size: 'md' },
  commandPalette: { size: 'md' },
  contextMenu: { size: 'md' },
  dashboardSearch: { size: 'md' },
  dropdownMenu: { size: 'md' },
  empty: { size: 'md' },
  fieldGroup: { size: 'md' },
  fileUpload: { size: 'md' },
  formField: { size: 'md' },
  input: { size: 'md' },
  inputDate: { size: 'md' },
  inputMenu: { size: 'md' },
  inputNumber: { size: 'md' },
  inputRating: { size: 'md' },
  inputTags: { size: 'md' },
  inputTime: { size: 'md' },
  kbd: { size: 'md' },
  listbox: { size: 'md' },
  pinInput: { size: 'md' },
  progress: { size: 'md' },
  progressGroup: { size: 'md' },
  radioGroup: { size: 'md' },
  select: { size: 'md' },
  selectMenu: { size: 'md' },
  slider: { size: 'md' },
  stepper: { size: 'md' },
  switch: { size: 'md' },
  tabs: { size: 'md' },
  textarea: { size: 'md' },
  timeline: { size: 'md' },
  tree: { size: 'md' },
  user: { size: 'md' },
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
