import { describe, expect, it } from 'vitest'
import {
  blocksColor,
  blocksCssUrl,
  blocksLength,
  blocksLevel,
  blocksLink,
  blocksPercent,
  blocksSafeColor,
  blocksSafeFont,
  blocksSpace,
  blocksUrl,
} from '../app/utils/blocks-style'
import { blocksThemeCss } from '../app/utils/blocks-theme'

describe('blocksThemeCss', () => {
  it('writes the colors and the fonts as variables on :root', () => {
    const css = blocksThemeCss({
      colors: {
        primary: '#0f766e',
        secondary: 'rgb(100 116 139)',
        text: '#111',
        accent: 'oklch(0.7 0.15 60)',
        muted: '#666',
        surface: '#f5f5f4',
        background: '#fffdf8',
        onPrimary: '#ffffff',
      },
      fonts: {
        heading: '"Fredoka", sans-serif',
        body: 'system-ui, sans-serif',
      },
    })

    expect(css).toBe(
      [
        ':root {',
        '  --pluto-blocks-color-primary: #0f766e;',
        '  --pluto-blocks-color-secondary: rgb(100 116 139);',
        '  --pluto-blocks-color-text: #111;',
        '  --pluto-blocks-color-accent: oklch(0.7 0.15 60);',
        '  --pluto-blocks-color-muted: #666;',
        '  --pluto-blocks-color-surface: #f5f5f4;',
        '  --pluto-blocks-color-background: #fffdf8;',
        '  --pluto-blocks-color-on-primary: #ffffff;',
        '  --pluto-blocks-font-heading: "Fredoka", sans-serif;',
        '  --pluto-blocks-font-body: system-ui, sans-serif;',
        '}',
      ].join('\n')
    )
  })

  it('writes only what the theme sets', () => {
    expect(blocksThemeCss({ colors: { primary: 'tomato' } })).toBe(
      ':root {\n  --pluto-blocks-color-primary: tomato;\n}'
    )
  })

  it('gives no text for an empty theme', () => {
    expect(blocksThemeCss(undefined)).toBe('')
    expect(blocksThemeCss({})).toBe('')
    expect(blocksThemeCss({ colors: {}, fonts: {} })).toBe('')
  })

  it('drops a value that could break out of the rule', () => {
    const css = blocksThemeCss({
      colors: {
        primary: 'red; } body { display: none',
        secondary: 'url(https://example.com/a.png)',
        text: '</style><script>alert(1)</script>',
        accent: 'red /* x */',
        muted: '#abc',
      },
      fonts: {
        heading: 'Arial; } a { color: red',
        body: 'url(x)',
      },
    })

    expect(css).toBe(':root {\n  --pluto-blocks-color-muted: #abc;\n}')
  })

  it('ignores a color name that the theme does not know', () => {
    expect(blocksThemeCss({ colors: { danger: 'red' } as never })).toBe('')
  })
})

describe('safe values', () => {
  it('accepts the usual CSS colors', () => {
    for (const color of [
      '#fff',
      '#ffffff80',
      'red',
      'transparent',
      'currentColor',
      'rgb(0 0 0 / 50%)',
      'hsl(210, 40%, 96%)',
      'color-mix(in oklab, red 20%, white)',
      'var(--brand, #fff)',
    ]) {
      expect(blocksSafeColor(color), color).toBe(color)
    }
  })

  it('refuses anything else', () => {
    for (const color of [
      '',
      'a;b',
      'url(x)',
      'red}',
      'rgb(0 0 0',
      '#gg',
      'x'.repeat(40),
    ]) {
      expect(blocksSafeColor(color), color).toBeUndefined()
    }
  })

  it('accepts a font stack', () => {
    expect(blocksSafeFont('"Open Sans", system-ui, sans-serif')).toBe(
      '"Open Sans", system-ui, sans-serif'
    )
    expect(blocksSafeFont('a;b')).toBeUndefined()
  })
})

describe('the values of the block props', () => {
  it('maps a color token to its variable, and keeps a CSS color', () => {
    expect(blocksColor('primary')).toBe('var(--pluto-blocks-color-primary)')
    expect(blocksColor('surface')).toBe('var(--pluto-blocks-color-surface)')
    expect(blocksColor('#ff0000')).toBe('#ff0000')
    expect(blocksColor('nope; x')).toBeUndefined()
    expect(blocksColor(undefined)).toBeUndefined()
  })

  it('maps a step of the scale to its variable, and keeps a safe length', () => {
    expect(blocksSpace('md')).toBe('var(--pluto-blocks-space-md)')
    expect(blocksSpace('2xl')).toBe('var(--pluto-blocks-space-2xl)')
    expect(blocksSpace('none')).toBe('0')
    expect(blocksSpace('24')).toBe('24px')
    expect(blocksSpace('3rem')).toBe('3rem')
    expect(blocksSpace('3rem; x')).toBeUndefined()
  })

  it('reads a length', () => {
    expect(blocksLength(320)).toBe('320px')
    expect(blocksLength('60vh')).toBe('60vh')
    expect(blocksLength('50%')).toBe('50%')
    expect(blocksLength('calc(1px)')).toBeUndefined()
  })

  it('reads a percent', () => {
    expect(blocksPercent('50')).toBe(50)
    expect(blocksPercent('33.3%')).toBe(33.3)
    expect(blocksPercent(0)).toBeUndefined()
    expect(blocksPercent('120')).toBeUndefined()
    expect(blocksPercent('')).toBeUndefined()
  })

  it('keeps a heading level from 1 to 6', () => {
    expect(blocksLevel('3')).toBe(3)
    expect(blocksLevel(1)).toBe(1)
    expect(blocksLevel('9')).toBe(2)
    expect(blocksLevel('x', 4)).toBe(4)
  })

  it('refuses an unsafe URL', () => {
    expect(blocksUrl('javascript:alert(1)')).toBeUndefined()
    expect(blocksUrl('data:text/html,x')).toBeUndefined()
    expect(blocksUrl('/pricing')).toBe('/pricing')
    expect(blocksUrl('#faq')).toBe('#faq')
    expect(blocksUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(blocksUrl('mailto:a@b.co')).toBe('mailto:a@b.co')
    expect(blocksUrl('/pricing', '/site/')).toBe('/site/pricing')
  })

  it('writes a link with a safe rel for a new tab', () => {
    expect(blocksLink('/a', undefined)).toEqual({ href: '/a' })
    expect(blocksLink('https://a.co', '_blank')).toEqual({
      href: 'https://a.co',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    expect(blocksLink('javascript:x', '_blank')).toBeUndefined()
  })

  it('writes a background image URL that cannot leave the url()', () => {
    expect(blocksCssUrl('/images/a.svg')).toBe('url("/images/a.svg")')
    const inner = blocksCssUrl('/a").x{b:c("')!.slice(5, -2)

    expect(inner).not.toMatch(/["()]/)
    expect(blocksCssUrl('javascript:x')).toBeUndefined()
    expect(blocksCssUrl('data:image/png;base64,AAAA')).toBeUndefined()
  })
})
