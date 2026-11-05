import { describe, expect, it } from 'vitest'
import {
  plutoSeoReadFrontmatter,
  plutoSeoWriteFrontmatter,
} from '../shared/utils/seo-fields'

describe('plutoSeoReadFrontmatter', () => {
  it('adds the flat keys from the seo block and keeps the block', () => {
    const fm = {
      title: 'Hello',
      seo: {
        title: 'Short',
        description: 'A line.',
        image: 'red-mug-k3j9a',
        noindex: true,
      },
    }
    expect(plutoSeoReadFrontmatter(fm)).toEqual({
      ...fm,
      seo_title: 'Short',
      seo_description: 'A line.',
      seo_image: 'red-mug-k3j9a',
      seo_noindex: true,
    })
  })

  it('does not change its input', () => {
    const fm = { seo: { title: 'Short' } }
    plutoSeoReadFrontmatter(fm)
    expect(fm).toEqual({ seo: { title: 'Short' } })
  })

  it('adds nothing for a file without a seo block, or with a bad one', () => {
    expect(plutoSeoReadFrontmatter({ title: 'a' })).toEqual({ title: 'a' })
    expect(plutoSeoReadFrontmatter({ seo: 'x' })).toEqual({ seo: 'x' })
    expect(plutoSeoReadFrontmatter({ seo: ['a'] })).toEqual({ seo: ['a'] })
  })

  it('ignores a noindex that is not true, and a value that is not text', () => {
    expect(
      plutoSeoReadFrontmatter({ seo: { noindex: false, title: 5 } })
    ).toEqual({ seo: { noindex: false, title: 5 } })
  })
})

describe('plutoSeoWriteFrontmatter', () => {
  it('folds the flat keys into the seo block and drops them', () => {
    expect(
      plutoSeoWriteFrontmatter({
        title: 'Hello',
        seo_title: 'Short',
        seo_description: 'A line.',
        seo_image: 'red-mug-k3j9a',
        seo_noindex: true,
      })
    ).toEqual({
      title: 'Hello',
      seo: {
        title: 'Short',
        description: 'A line.',
        image: 'red-mug-k3j9a',
        noindex: true,
      },
    })
  })

  it('keeps the keys of the seo block that it does not know', () => {
    expect(
      plutoSeoWriteFrontmatter({
        seo: { title: 'Old', canonical: 'https://a.io/x' },
        seo_title: 'New',
      })
    ).toEqual({ seo: { title: 'New', canonical: 'https://a.io/x' } })
  })

  it('removes a key whose flat value is empty or missing (the author cleared it)', () => {
    expect(
      plutoSeoWriteFrontmatter({
        seo: { title: 'Old', description: 'Old', image: 'x', canonical: 'c' },
        seo_title: '',
        seo_description: undefined,
      })
    ).toEqual({ seo: { canonical: 'c' } })
  })

  it('removes an empty seo block', () => {
    expect(
      plutoSeoWriteFrontmatter({
        title: 'Hello',
        seo: { title: 'Old' },
        seo_title: '',
      })
    ).toEqual({ title: 'Hello' })
  })

  it('does not write noindex false, and removes an old noindex', () => {
    expect(plutoSeoWriteFrontmatter({ seo_noindex: false })).toEqual({})
    expect(
      plutoSeoWriteFrontmatter({
        seo: { title: 'T', noindex: true },
        seo_title: 'T',
        seo_noindex: false,
      })
    ).toEqual({ seo: { title: 'T' } })
  })

  it('leaves a file with no seo data alone', () => {
    expect(plutoSeoWriteFrontmatter({ title: 'a', draft: true })).toEqual({
      title: 'a',
      draft: true,
    })
  })

  it('leaves a value of another type in the seo block as the author wrote it', () => {
    expect(
      plutoSeoWriteFrontmatter({ seo: { title: ['a'], noindex: 'yes' } })
    ).toEqual({ seo: { title: ['a'], noindex: 'yes' } })
  })

  it('does not change its input', () => {
    const fm = { seo: { title: 'Old' }, seo_title: 'New' }
    plutoSeoWriteFrontmatter(fm)
    expect(fm).toEqual({ seo: { title: 'Old' }, seo_title: 'New' })
  })

  it('reads back what it wrote', () => {
    const written = plutoSeoWriteFrontmatter({
      seo_title: 'T',
      seo_description: 'D',
      seo_image: 'i',
      seo_noindex: true,
    })
    const read = plutoSeoReadFrontmatter(written)
    expect(read).toMatchObject({
      seo_title: 'T',
      seo_description: 'D',
      seo_image: 'i',
      seo_noindex: true,
    })
  })
})
