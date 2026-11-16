import { describe, expect, it } from 'vitest'
import { isKit, kitFromPost, readSettings, themeSnippet } from '../src/theme'
import { KIT_SETTINGS, phpSerialize } from './fixtures'

const kitPost = {
  id: 1,
  type: 'elementor_library',
  status: 'publish',
  title: 'Default Kit',
  slug: 'default-kit',
  link: '',
  parent: 0,
  date: '',
  content: '',
  excerpt: '',
  attachmentUrl: '',
  meta: {
    _elementor_template_type: 'kit',
    _elementor_page_settings: phpSerialize(KIT_SETTINGS),
  },
}

describe('the kit to the theme', () => {
  it('finds the kit post', () => {
    expect(isKit(kitPost)).toBe(true)
    expect(
      isKit({ ...kitPost, meta: { _elementor_template_type: 'page' } })
    ).toBe(false)
    expect(isKit({ ...kitPost, type: 'page' })).toBe(false)
  })

  it('builds the four colors from the system colors', () => {
    expect(kitFromPost(kitPost).theme.colors).toEqual({
      primary: '#EF5777',
      secondary: '#51C9C0',
      text: '#222F3E',
      accent: '#1E90FF',
    })
  })

  it('keeps a custom color by its id', () => {
    expect(kitFromPost(kitPost).globalColors.ab12cd3).toBe('#F5F6F6')
  })

  it('takes the heading font from the primary typography and the body font from the text one', () => {
    const kit = kitFromPost(kitPost)

    expect(kit.theme.fonts).toEqual({
      heading: '"Playfair Display", serif',
      body: '"Work Sans", sans-serif',
    })
    expect(kit.headingFont).toBe('Playfair Display')
    expect(kit.bodyFont).toBe('Work Sans')
  })

  it('lists the fonts with their weights', () => {
    expect(kitFromPost(kitPost).fonts).toEqual([
      { family: 'Playfair Display', weights: ['600'] },
      { family: 'Work Sans', weights: ['400'] },
    ])
  })

  it('gives an empty theme for a kit with no settings', () => {
    const kit = kitFromPost({
      ...kitPost,
      meta: { _elementor_template_type: 'kit' },
    })

    expect(kit.theme).toEqual({ colors: {}, fonts: {} })
  })

  it('reads settings that are JSON, and ignores text that is neither', () => {
    expect(readSettings('{"a":1}')).toEqual({ a: 1 })
    expect(readSettings('nonsense')).toEqual({})
    expect(readSettings(undefined)).toEqual({})
  })

  it('writes the app.config.ts snippet', () => {
    const snippet = themeSnippet(kitFromPost(kitPost).theme)

    expect(snippet).toContain('plutoBlocksTheme')
    expect(snippet).toContain("primary: '#EF5777'")
    expect(snippet).toContain(`heading: '"Playfair Display", serif'`)
  })
})
