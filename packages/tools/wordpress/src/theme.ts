import type { PhpValue } from './php'
import type { BlocksTheme, FontUse, Kit, WxrPost } from './types'
import { unserialize } from './php'
import { normalizeColor } from './values'

type Settings = Record<string, unknown>

const SYSTEM_COLORS = ['primary', 'secondary', 'text', 'accent'] as const

const SERIF =
  /serif|playfair|merriweather|lora|baskerville|garamond|georgia|times|slab|crimson|cardo|spectral|bitter|domine|vollkorn|cormorant/i

export function emptyKit(): Kit {
  return {
    theme: { colors: {}, fonts: {} },
    globalColors: {},
    fonts: [],
  }
}

function listOf(value: unknown): Settings[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Settings =>
          typeof entry === 'object' && entry !== null
      )
    : []
}

function fontStack(family: string): string {
  const generic =
    SERIF.test(family) && !/sans/i.test(family) ? 'serif' : 'sans-serif'

  return `"${family.replace(/["\\]/g, '')}", ${generic}`
}

/** Reads the settings of a post meta. WordPress stores them PHP-serialized. */
export function readSettings(value: string | undefined): Settings {
  if (!value) {
    return {}
  }

  try {
    const parsed: PhpValue = unserialize(value)

    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Settings)
      : {}
  } catch {
    try {
      const parsed = JSON.parse(value) as unknown

      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Settings)
        : {}
    } catch {
      return {}
    }
  }
}

export function isKit(post: WxrPost): boolean {
  return (
    post.type === 'elementor_library' &&
    post.meta._elementor_template_type === 'kit'
  )
}

/**
 * Builds the `plutoBlocksTheme` of the site from the Elementor kit: the four system colors
 * and the fonts of the primary and text typography.
 * @see https://elementor.com/help/site-settings/
 */
export function kitFromPost(post: WxrPost): Kit {
  const settings = readSettings(post.meta._elementor_page_settings)
  const colors: BlocksTheme['colors'] = {}
  const globalColors: Record<string, string> = {}

  for (const entry of [
    ...listOf(settings.system_colors),
    ...listOf(settings.custom_colors),
  ]) {
    const id = String(entry._id ?? '')
    const color = normalizeColor(String(entry.color ?? ''))

    if (!id || !color) {
      continue
    }

    globalColors[id] = color

    if ((SYSTEM_COLORS as readonly string[]).includes(id)) {
      colors[id as (typeof SYSTEM_COLORS)[number]] = color
    }
  }

  const globals = settings.__globals__ as Record<string, unknown> | undefined
  const reference = String(globals?.body_background_color ?? '')
  const referenced =
    globalColors[
      new URLSearchParams(reference.split('?')[1] ?? '').get('id') ?? ''
    ]

  colors.background =
    referenced ??
    normalizeColor(String(settings.body_background_color ?? '')) ??
    '#ffffff'

  const typography = [
    ...listOf(settings.system_typography),
    ...listOf(settings.custom_typography),
  ]
  const familyOf = (id: string) => {
    const family = typography.find(
      (entry) => entry._id === id
    )?.typography_font_family

    return typeof family === 'string' && family ? family : undefined
  }
  const headingFont = familyOf('primary')
  const bodyFont = familyOf('text') ?? familyOf('secondary')
  const fonts: FontUse[] = []

  for (const entry of typography) {
    const family = entry.typography_font_family
    const weight = String(entry.typography_font_weight ?? '')

    if (typeof family !== 'string' || !family) {
      continue
    }

    const known = fonts.find((font) => font.family === family)

    if (known) {
      if (/^\d{3}$/.test(weight) && !known.weights.includes(weight)) {
        known.weights.push(weight)
      }
    } else {
      fonts.push({
        family,
        weights: /^\d{3}$/.test(weight) ? [weight] : [],
      })
    }
  }

  return {
    theme: {
      colors,
      fonts: {
        heading: headingFont ? fontStack(headingFont) : undefined,
        body: bodyFont ? fontStack(bodyFont) : undefined,
      },
    },
    globalColors,
    headingFont,
    bodyFont,
    fonts,
  }
}

/** The text to paste in `app.config.ts`. */
export function themeSnippet(theme: BlocksTheme): string {
  const colors = Object.entries(theme.colors).filter(([, value]) => value)
  const fonts = Object.entries(theme.fonts).filter(([, value]) => value)
  const lines = ['export default defineAppConfig({', '  plutoBlocksTheme: {']

  if (colors.length > 0) {
    lines.push('    colors: {')

    for (const [name, value] of colors) {
      lines.push(`      ${name}: '${value}',`)
    }

    lines.push('    },')
  }

  if (fonts.length > 0) {
    lines.push('    fonts: {')

    for (const [name, value] of fonts) {
      lines.push(`      ${name}: '${value}',`)
    }

    lines.push('    },')
  }

  lines.push('  },', '})')

  return lines.join('\n')
}

export function cleanTheme(theme: BlocksTheme): BlocksTheme {
  return {
    colors: Object.fromEntries(
      Object.entries(theme.colors).filter(([, value]) => value)
    ),
    fonts: Object.fromEntries(
      Object.entries(theme.fonts).filter(([, value]) => value)
    ),
  }
}
