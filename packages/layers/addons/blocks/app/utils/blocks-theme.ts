import type { PlutoBlocksTheme } from '../../shared/types/blocks-theme'
import { blocksSafeColor, blocksSafeFont } from './blocks-style'

const COLOR_VARIABLES: Record<string, string> = {
  primary: '--pluto-blocks-color-primary',
  secondary: '--pluto-blocks-color-secondary',
  text: '--pluto-blocks-color-text',
  accent: '--pluto-blocks-color-accent',
  muted: '--pluto-blocks-color-muted',
  surface: '--pluto-blocks-color-surface',
  background: '--pluto-blocks-color-background',
  onPrimary: '--pluto-blocks-color-on-primary',
}

const FONT_VARIABLES: Record<string, string> = {
  heading: '--pluto-blocks-font-heading',
  body: '--pluto-blocks-font-body',
}

/**
 * Writes the theme as one `:root` rule of CSS variables. A name that the theme does not know, and
 * a value that is not a safe color or font stack, are left out. An empty theme gives an empty text.
 * @see https://pluto.vulmix.dev/docs/layers/blocks#theme
 */
export function blocksThemeCss(theme: PlutoBlocksTheme | undefined): string {
  const lines: string[] = []

  for (const [name, variable] of Object.entries(COLOR_VARIABLES)) {
    const value = blocksSafeColor(
      (theme?.colors as Record<string, unknown> | undefined)?.[name]
    )
    if (value) {
      lines.push(`  ${variable}: ${value};`)
    }
  }

  for (const [name, variable] of Object.entries(FONT_VARIABLES)) {
    const value = blocksSafeFont(
      (theme?.fonts as Record<string, unknown> | undefined)?.[name]
    )
    if (value) {
      lines.push(`  ${variable}: ${value};`)
    }
  }

  return lines.length ? `:root {\n${lines.join('\n')}\n}` : ''
}
