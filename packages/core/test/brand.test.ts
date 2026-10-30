import { describe, expect, it } from 'vitest'
import {
  isPlutoBrandHex,
  PLUTO_BRAND_STEPS,
  plutoBrandContrast,
  plutoBrandCss,
  plutoBrandScale,
} from '../shared/utils/brand'

const lightness = (value: string) => Number(value.match(/oklch\(([\d.]+)%/)![1])

describe('isPlutoBrandHex', () => {
  it('accepts 3- and 6-digit hex colors only', () => {
    expect(isPlutoBrandHex('#0F766E')).toBe(true)
    expect(isPlutoBrandHex('#abc')).toBe(true)
    expect(isPlutoBrandHex('teal')).toBe(false)
    expect(isPlutoBrandHex('#0F766')).toBe(false)
    expect(isPlutoBrandHex(undefined)).toBe(false)
  })
})

describe('plutoBrandScale', () => {
  const scale = plutoBrandScale('#0F766E')

  it('gives the 11 steps, lighter to darker', () => {
    expect(Object.keys(scale).map(Number)).toEqual([...PLUTO_BRAND_STEPS])
    const values = PLUTO_BRAND_STEPS.map((step) => lightness(scale[step]))
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeLessThan(values[i - 1]!)
    }
  })

  it('keeps the brand color as step 600', () => {
    // #0F766E (teal-700 in Tailwind 3) is about oklch(51.1% 0.086 186).
    expect(lightness(scale[600])).toBeCloseTo(51.1, 0)
    expect(scale[600]).toMatch(/ 18\d\.\d\d\)$/)
  })

  it('reads a 3-digit hex', () => {
    expect(plutoBrandScale('#f00')[600]).toBe(plutoBrandScale('#ff0000')[600])
  })
})

describe('plutoBrandContrast', () => {
  it('gives the contrast with white text', () => {
    expect(plutoBrandContrast('#000000')).toBeCloseTo(21, 0)
    expect(plutoBrandContrast('#ffffff')).toBeCloseTo(1, 5)
    expect(plutoBrandContrast('#0F766E')).toBeGreaterThan(4.5)
    expect(plutoBrandContrast('#FACC15')).toBeLessThan(4.5)
  })
})

describe('plutoBrandCss', () => {
  it('is empty without a brand or without a style field', () => {
    expect(plutoBrandCss(undefined)).toBe('')
    expect(plutoBrandCss({ name: 'Acme', logo: '/a.svg' })).toBe('')
    expect(plutoBrandCss({ primary: 'teal' })).toBe('')
  })

  it('sets the primary scale, the radius and the fonts under the doubled admin selectors', () => {
    const css = plutoBrandCss({
      primary: '#0F766E',
      radius: 0.5,
      font: '"Inter"',
    })
    expect(css).toContain(
      ':root[data-pluto-admin][data-pluto-admin],\n[data-pluto-admin-scope][data-pluto-admin-scope] {'
    )
    expect(css).toContain('--ui-color-primary-50: oklch(')
    expect(css).toContain('--ui-color-primary-950: oklch(')
    expect(css).toContain('--ui-radius: 0.5rem;')
    expect(css).toContain(
      '--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;'
    )
    // The title font follows the text font when no display font is set.
    expect(css).toContain(
      '--pluto-admin-font-display: "Inter", ui-sans-serif, system-ui, sans-serif;'
    )
  })

  it('uses its own title font when it is set', () => {
    const css = plutoBrandCss({ font: '"Inter"', fontDisplay: '"Lora"' })
    expect(css).toContain('--pluto-admin-font-display: "Lora",')
  })

  it('ignores a negative radius', () => {
    expect(plutoBrandCss({ radius: -1 })).toBe('')
  })
})
