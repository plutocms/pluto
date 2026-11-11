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
 *
 * `useHead` puts the attribute in the server HTML, but in the browser it
 * writes <html> after the render, a frame late. The admin build is scoped to
 * the attribute, so a client navigation from the public site showed one frame
 * of the admin with no styles. `onMounted` runs in the same task as the DOM
 * change, before the paint, so the attribute is set there too. A count keeps
 * it while another admin layout is mounted.
 */
let mountedAdminLayouts = 0

export function usePlutoAdminTheme() {
  useHead({ htmlAttrs: { 'data-pluto-admin': '' } })
  if (import.meta.client) {
    onMounted(() => {
      mountedAdminLayouts++
      document.documentElement.setAttribute('data-pluto-admin', '')
    })
    onUnmounted(() => {
      mountedAdminLayouts--
      if (mountedAdminLayouts === 0) {
        document.documentElement.removeAttribute('data-pluto-admin')
      }
    })
  }
}

/**
 * The default props of the Nuxt UI components in the admin: the default size
 * of Nuxt UI (`md`) for every component that has a size, and an arrow on
 * every tooltip, popover, dropdown menu and select list. They live here, not
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
  dropdownMenu: { size: 'md', arrow: true },
  empty: { size: 'md' },
  fieldGroup: { size: 'md' },
  fileUpload: { size: 'md' },
  formField: { size: 'md' },
  input: { size: 'md' },
  inputDate: { size: 'md' },
  inputMenu: { size: 'md', arrow: true },
  inputNumber: { size: 'md' },
  inputRating: { size: 'md' },
  inputTags: { size: 'md' },
  inputTime: { size: 'md' },
  kbd: { size: 'md' },
  listbox: { size: 'md' },
  pinInput: { size: 'md' },
  popover: { arrow: true },
  progress: { size: 'md' },
  progressGroup: { size: 'md' },
  radioGroup: { size: 'md' },
  select: { size: 'md', arrow: true },
  selectMenu: { size: 'md', arrow: true },
  slider: { size: 'md' },
  stepper: { size: 'md' },
  switch: { size: 'md' },
  tabs: { size: 'md' },
  textarea: { size: 'md' },
  timeline: { size: 'md' },
  tooltip: { arrow: true },
  tree: { size: 'md' },
  user: { size: 'md' },
} as const

/**
 * The slot classes of the Nuxt UI components in the admin. `font-sans` is the
 * admin font (admin-theme.css sets `--font-sans` under the admin selectors).
 * It comes after the `app.config` classes of the site, so a site's
 * `ui.button.slots.base: 'font-outfit'` does not reach the admin buttons.
 * The shadow of the floating surfaces is a CSS rule (`shadow-pluto-elevated`
 * in pluto-layer.css), not a slot class here: a component that sets its own
 * `ui.content` replaces the slot class of the theme.
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
