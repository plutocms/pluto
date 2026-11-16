export type PlutoBlocksColorName =
  | 'primary'
  | 'secondary'
  | 'text'
  | 'accent'
  | 'muted'
  | 'surface'
  | 'background'
  | 'onPrimary'

/**
 * The theme of the blocks, set in `app.config.ts` under `plutoBlocksTheme`. Every field is
 * optional. A value that is not a safe CSS color or font stack is ignored.
 * @see https://pluto.vulmix.dev/docs/layers/blocks#theme
 *
 * ```ts
 * export default defineAppConfig({
 *   plutoBlocksTheme: {
 *     colors: { primary: '#0f766e', background: '#fffdf8' },
 *     fonts: { heading: '"Fredoka", sans-serif', body: 'system-ui, sans-serif' },
 *   },
 * })
 * ```
 */
export interface PlutoBlocksTheme {
  /** The colors by name. `onPrimary` is the text color on a primary button. */
  colors?: Partial<Record<PlutoBlocksColorName, string>>
  /** The font stacks of the headings and of the body text. The app must load the fonts. */
  fonts?: {
    heading?: string
    body?: string
  }
}

declare module '@nuxt/schema' {
  interface AppConfigInput {
    plutoBlocksTheme?: PlutoBlocksTheme
  }
  interface AppConfig {
    plutoBlocksTheme?: PlutoBlocksTheme
  }
}
