import type { PlutoBrand } from '../types/brand'

export const PLUTO_BRAND_STEPS = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const

const STEP_LIGHTNESS: Record<number, number> = {
  50: 0.971,
  100: 0.936,
  200: 0.885,
  300: 0.808,
  400: 0.711,
  500: 0.637,
  600: 0.577,
  700: 0.505,
  800: 0.444,
  900: 0.396,
  950: 0.258,
}
const STEP_CHROMA: Record<number, number> = {
  50: 0.15,
  100: 0.3,
  200: 0.5,
  300: 0.75,
  400: 0.92,
  500: 1,
  600: 1,
  700: 0.9,
  800: 0.78,
  900: 0.66,
  950: 0.5,
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function hexToRgb(hex: string): [number, number, number] {
  const full =
    hex.length === 4
      ? `#${hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')}`
      : hex
  const n = Number.parseInt(full.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

function hexToOklch(hex: string): {
  l: number
  c: number
  h: number
} {
  const [r, g, b] = hexToRgb(hex).map((value) => toLinear(value / 255)) as [
    number,
    number,
    number,
  ]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return {
    l: L,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  }
}

export function plutoBrandContrast(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((value) => toLinear(value / 255)) as [
    number,
    number,
    number,
  ]
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (luminance + 0.05)
}

export function isPlutoBrandHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

export function plutoBrandScale(
  hex: string
): Record<(typeof PLUTO_BRAND_STEPS)[number], string> {
  const { l, c, h } = hexToOklch(hex)
  const light = STEP_LIGHTNESS[50]!
  const dark = STEP_LIGHTNESS[950]!
  const anchor = STEP_LIGHTNESS[600]!
  const scale = {} as Record<(typeof PLUTO_BRAND_STEPS)[number], string>
  for (const step of PLUTO_BRAND_STEPS) {
    const target = STEP_LIGHTNESS[step]!
    let lightness = l
    if (target > anchor) {
      lightness =
        l + ((target - anchor) / (light - anchor)) * (Math.max(light, l) - l)
    } else if (target < anchor) {
      lightness =
        l - ((anchor - target) / (anchor - dark)) * (l - Math.min(dark, l))
    }
    const chroma = c * STEP_CHROMA[step]!
    scale[step] =
      `oklch(${(lightness * 100).toFixed(1)}% ${chroma.toFixed(3)} ${h.toFixed(2)})`
  }
  return scale
}

// The admin selectors, twice, so the brand rule wins over admin-theme.css and
// the radius rule of pluto-layer.css whatever order the styles load in.
const BRAND_SELECTOR =
  ':root[data-pluto-admin][data-pluto-admin],\n[data-pluto-admin-scope][data-pluto-admin-scope]'

export function plutoBrandCss(brand: PlutoBrand | undefined): string {
  if (!brand) {
    return ''
  }
  const lines: string[] = []
  if (isPlutoBrandHex(brand.primary)) {
    const scale = plutoBrandScale(brand.primary)
    for (const step of PLUTO_BRAND_STEPS) {
      lines.push(`  --ui-color-primary-${step}: ${scale[step]};`)
    }
  }
  if (
    typeof brand.radius === 'number' &&
    Number.isFinite(brand.radius) &&
    brand.radius >= 0
  ) {
    lines.push(`  --ui-radius: ${brand.radius}rem;`)
  }
  const font = brand.font?.trim()
  const display = brand.fontDisplay?.trim() || font
  if (font) {
    lines.push(`  --font-sans: ${font}, ui-sans-serif, system-ui, sans-serif;`)
  }
  if (display) {
    lines.push(
      `  --pluto-admin-font-display: ${display}, ui-sans-serif, system-ui, sans-serif;`
    )
  }
  return lines.length > 0 ? `${BRAND_SELECTOR} {\n${lines.join('\n')}\n}\n` : ''
}
