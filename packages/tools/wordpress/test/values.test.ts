import { describe, expect, it } from 'vitest'
import { emptyKit } from '../src/theme'
import {
  boxOf,
  colorOf,
  lengthOf,
  nearest,
  pxOf,
  radiusOf,
  shadowOf,
  snapFontSize,
  snapSpace,
  SPACE_SCALE,
  TEXT_SCALE,
} from '../src/values'
import { context } from './fixtures'

describe('colors', () => {
  it('turns a reference to a system color into its token', () => {
    const ctx = context()

    for (const id of ['primary', 'secondary', 'text', 'accent']) {
      const settings = {
        title_color: '#000000',
        __globals__: { title_color: `globals/colors?id=${id}` },
      }

      expect(colorOf(ctx, settings, 'title_color')).toBe(id)
    }
  })

  it('turns a reference to a custom color into its hex', () => {
    const ctx = context({
      kit: { ...emptyKit(), globalColors: { ab12cd3: '#F5F6F6' } },
    })
    const settings = {
      __globals__: { background_color: 'globals/colors?id=ab12cd3' },
    }

    expect(colorOf(ctx, settings, 'background_color')).toBe('#F5F6F6')
  })

  it('falls back to the literal value when the global is unknown', () => {
    const settings = {
      title_color: '#123456',
      __globals__: { title_color: 'globals/colors?id=zzz' },
    }

    expect(colorOf(context(), settings, 'title_color')).toBe('#123456')
  })

  it('keeps a literal color exact', () => {
    expect(colorOf(context(), { c: '#FfFfFf' }, 'c')).toBe('#FfFfFf')
    expect(colorOf(context(), { c: 'rgba(0,0,0,0.5)' }, 'c')).toBe(
      'rgba(0,0,0,0.5)'
    )
  })

  it('drops a value that is not a safe color', () => {
    expect(colorOf(context(), { c: 'url(x)' }, 'c')).toBeUndefined()
    expect(colorOf(context(), { c: '' }, 'c')).toBeUndefined()
  })

  it('reads the variable of a global color', () => {
    expect(colorOf(context(), { c: 'var(--e-global-color-accent)' }, 'c')).toBe(
      'accent'
    )
  })
})

describe('the scale', () => {
  it('rounds a size to the nearest step', () => {
    expect(nearest(45, SPACE_SCALE).token).toBe('lg')
    expect(nearest(100, SPACE_SCALE).token).toBe('xl')
    expect(nearest(500, SPACE_SCALE).token).toBe('2xl')
    expect(nearest(0, SPACE_SCALE)).toEqual({ token: 'none', exact: true })
    expect(nearest(16, SPACE_SCALE)).toEqual({ token: 'sm', exact: true })
  })

  it('goes to the smaller step on a tie', () => {
    expect(nearest(20, SPACE_SCALE).token).toBe('sm')
  })

  it('reports a rounding, and nothing for an exact value', () => {
    const ctx = context()

    expect(snapSpace(ctx, 'section padding', 16)).toBe('sm')
    expect(ctx.report.roundings).toEqual([])
    expect(snapSpace(ctx, 'section padding', 45)).toBe('lg')
    expect(ctx.report.roundings).toEqual(['section padding: 45px became lg'])
  })

  it('does not report the same rounding twice', () => {
    const ctx = context()

    snapSpace(ctx, 'gap', 45)
    snapSpace(ctx, 'gap', 45)

    expect(ctx.report.roundings).toHaveLength(1)
  })

  it('reads px, em and rem, and ignores other units', () => {
    expect(pxOf({ unit: 'px', size: 12 })).toBe(12)
    expect(pxOf({ unit: 'em', size: 2 })).toBe(32)
    expect(pxOf({ unit: 'rem', size: 1.5 })).toBe(24)
    expect(pxOf({ unit: 'vw', size: 5 })).toBeUndefined()
    expect(pxOf('12')).toBe(12)
  })

  it('reads a padding box in px', () => {
    expect(
      boxOf({ unit: 'px', top: '10', right: '', bottom: '20', left: '0' })
    ).toEqual({
      top: 10,
      right: 0,
      bottom: 20,
      left: 0,
    })
    expect(boxOf({ unit: '%', top: '10' })).toBeUndefined()
  })

  it('rounds a font size to a token, or to the default size', () => {
    const ctx = context()
    const size = (value: number) => ({
      typography_font_size: { unit: 'px', size: value },
    })

    expect(snapFontSize(ctx, 'text', size(22), TEXT_SCALE)).toBe('xl')
    expect(snapFontSize(ctx, 'text', size(16), TEXT_SCALE)).toBeUndefined()
    expect(snapFontSize(ctx, 'text', size(30), TEXT_SCALE)).toBe('xl')
    expect(ctx.report.roundings).toEqual(['text size: 30px became xl'])
  })

  it('rounds a radius and a shadow', () => {
    const ctx = context()
    const corners = (unit: string, value: string) => ({
      border_radius: {
        unit,
        top: value,
        right: value,
        bottom: value,
        left: value,
      },
    })

    expect(radiusOf(ctx, corners('px', '20'))).toBe('lg')
    expect(radiusOf(ctx, corners('%', '50'))).toBe('full')
    expect(radiusOf(ctx, corners('px', '0'))).toBeUndefined()
    expect(
      shadowOf(ctx, {
        box_shadow_box_shadow_type: 'yes',
        box_shadow_box_shadow: { blur: 30 },
      })
    ).toBe('lg')
    expect(shadowOf(ctx, { box_shadow_box_shadow_type: '' })).toBeUndefined()
  })

  it('writes a length, and drops one with a unit the kit does not know', () => {
    expect(lengthOf({ unit: '%', size: 50 })).toBe('50%')
    expect(lengthOf({ unit: 'px', size: 320 })).toBe('320px')
    expect(lengthOf({ unit: 'custom', size: 3 })).toBeUndefined()
    expect(lengthOf({ unit: 'px', size: 0 })).toBeUndefined()
  })
})
