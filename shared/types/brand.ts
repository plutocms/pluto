/**
 * The brand of the admin (white label), set by the developer in
 * `app.config.ts` under `pluto.brand`. Every field is optional. With no brand,
 * the admin shows the Pluto look and links.
 *
 * ```ts
 * export default defineAppConfig({
 *   pluto: {
 *     brand: {
 *       name: 'Acme Studio',
 *       logo: '/brand/acme.svg',
 *       logoDark: '/brand/acme-white.svg',
 *       mark: '/brand/acme-mark.svg',
 *       url: 'https://acme.studio',
 *       helpUrl: 'mailto:help@acme.studio',
 *       primary: '#0F766E',
 *       plutoLinks: false,
 *     },
 *   },
 * })
 * ```
 */
export interface PlutoBrand {
  /** The agency or product name. The alt text of the logos and the last part of the tab title. */
  name?: string
  /** The logo for a light background (the sign-in card in light mode). A URL. */
  logo?: string
  /** The logo for a dark background (the admin navbar, the sign-in card in dark mode). A URL. */
  logoDark?: string
  /** A small square logo for small screens. A URL. Default: `logoDark`, then `logo`. */
  mark?: string
  /** The agency website. The user menu links to it, with `name` as the label. */
  url?: string
  /** A help link for the client (a page, `mailto:` or a chat). The user menu shows "Help". */
  helpUrl?: string
  /**
   * The primary color, a hex value such as `#0F766E`. Core makes the whole
   * scale from it. The color is step 600: the primary button in light mode.
   * Dark mode uses the lighter step 400. Pick a color with 4.5:1 contrast
   * against white text.
   */
  primary?: string
  /** The corner radius of the admin, in rem. Default 0.25. */
  radius?: number
  /** The text font of the admin, as a font-family value. The app must load the font. */
  font?: string
  /** The font of the page titles. Default: `font` when it is set, else Fredoka. */
  fontDisplay?: string
  /** Show the links to Pluto (the user menu item "Pluto on GitHub"). Default true. */
  plutoLinks?: boolean
}

declare module '@nuxt/schema' {
  interface AppConfigInput {
    pluto?: {
      brand?: PlutoBrand
    }
  }
  interface AppConfig {
    pluto?: {
      brand?: PlutoBrand
    }
  }
}
