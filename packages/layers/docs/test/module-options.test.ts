import { describe, expect, it } from 'vitest'
import {
  CMS_OFF_ERROR,
  isValidSource,
  normalizeRoutePrefix,
  resolvePlutoDocsOptions,
} from '../modules/pluto-docs/options'

describe('resolvePlutoDocsOptions', () => {
  it('has no type by default', () => {
    expect(resolvePlutoDocsOptions({}, { cmsEnabled: true })).toEqual({
      enabled: true,
      render: 'hybrid',
      runtimeMaxAge: 10,
      blocks: { discover: true },
      types: [],
      errors: [],
    })
  })

  it('checks blocks.discover', () => {
    const ctx = { cmsEnabled: true }
    expect(
      resolvePlutoDocsOptions({ blocks: { discover: false } }, ctx).blocks
    ).toEqual({ discover: false })
    const bad = resolvePlutoDocsOptions(
      { blocks: { discover: 'no' as never } },
      ctx
    )
    expect(bad.blocks).toEqual({ discover: true })
    expect(bad.errors).toHaveLength(1)
    expect(
      resolvePlutoDocsOptions({ blocks: 3 as never }, ctx).errors
    ).toHaveLength(1)
  })

  it('is off with an error when the CMS is off', () => {
    const result = resolvePlutoDocsOptions(
      { types: [{ preset: 'docs', name: 'doc', source: '' }] },
      { cmsEnabled: false }
    )
    expect(result).toEqual({
      enabled: false,
      render: 'build',
      runtimeMaxAge: 10,
      blocks: { discover: false },
      types: [],
      errors: [CMS_OFF_ERROR],
    })
  })

  it('keeps a valid docs type', () => {
    const result = resolvePlutoDocsOptions(
      {
        types: [
          {
            preset: 'docs',
            name: 'doc',
            source: '',
            label: 'Page',
            exclude: ['drafts/'],
          },
        ],
      },
      { cmsEnabled: true }
    )
    expect(result.errors).toEqual([])
    expect(result.types).toEqual([
      {
        preset: 'docs',
        name: 'doc',
        source: '',
        label: 'Page',
        exclude: ['drafts/'],
        routePrefix: '',
      },
    ])
  })

  it('accepts a nested source and normalizes the route prefix', () => {
    const result = resolvePlutoDocsOptions(
      {
        types: [
          {
            preset: 'docs',
            name: 'guide',
            source: '1.docs/api',
            routePrefix: 'docs/',
          },
        ],
      },
      { cmsEnabled: true }
    )
    expect(result.types[0]).toMatchObject({
      source: '1.docs/api',
      routePrefix: '/docs',
    })
  })

  it('keeps a navGroup string or false, and drops a type with a bad one', () => {
    const result = resolvePlutoDocsOptions(
      {
        types: [
          { preset: 'docs', name: 'a', source: '', navGroup: 'shop:catalog' },
          { preset: 'docs', name: 'b', source: '', navGroup: false },
          { preset: 'docs', name: 'c', source: '' },
          { preset: 'docs', name: 'd', source: '', navGroup: 5 as never },
        ],
      },
      { cmsEnabled: true }
    )
    expect(result.types.map((type) => type.navGroup)).toEqual([
      'shop:catalog',
      false,
      undefined,
    ])
    expect(result.errors).toHaveLength(1)
  })

  it('drops a type with an unknown preset', () => {
    const result = resolvePlutoDocsOptions(
      { types: [{ preset: 'blog', name: 'doc', source: '' } as never] },
      { cmsEnabled: true }
    )
    expect(result.types).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it('drops a type with a bad name or source', () => {
    const result = resolvePlutoDocsOptions(
      {
        types: [
          { preset: 'docs', name: 'Bad Name', source: '' },
          { preset: 'docs', name: 'doc', source: '../x' },
          { preset: 'docs', name: 'doc', source: '/abs' },
        ],
      },
      { cmsEnabled: true }
    )
    expect(result.types).toEqual([])
    expect(result.errors).toHaveLength(3)
  })

  it('drops a duplicate name', () => {
    const result = resolvePlutoDocsOptions(
      {
        types: [
          { preset: 'docs', name: 'doc', source: '' },
          { preset: 'docs', name: 'doc', source: 'other' },
        ],
      },
      { cmsEnabled: true }
    )
    expect(result.types).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })

  it('drops a type whose exclude is not a list of strings', () => {
    const result = resolvePlutoDocsOptions(
      {
        types: [
          {
            preset: 'docs',
            name: 'doc',
            source: '',
            exclude: 'index' as never,
          },
        ],
      },
      { cmsEnabled: true }
    )
    expect(result.types).toEqual([])
    expect(result.errors).toHaveLength(1)
  })
})

describe('isValidSource', () => {
  it('accepts an empty source and nested folders', () => {
    expect(isValidSource('')).toBe(true)
    expect(isValidSource('docs')).toBe(true)
    expect(isValidSource('1.docs/2.api')).toBe(true)
  })

  it('refuses unsafe paths', () => {
    expect(isValidSource('..')).toBe(false)
    expect(isValidSource('a//b')).toBe(false)
    expect(isValidSource('A')).toBe(false)
    expect(isValidSource(undefined)).toBe(false)
  })
})

describe('normalizeRoutePrefix', () => {
  it('gives a leading slash and no trailing slash', () => {
    expect(normalizeRoutePrefix('docs')).toBe('/docs')
    expect(normalizeRoutePrefix('/a/b/')).toBe('/a/b')
    expect(normalizeRoutePrefix('/')).toBe('')
    expect(normalizeRoutePrefix(undefined)).toBe('')
  })
})

describe('render option', () => {
  it('is hybrid by default', () => {
    expect(resolvePlutoDocsOptions({}, { cmsEnabled: true }).render).toBe(
      'hybrid'
    )
  })

  it.each(['hybrid', 'build', 'runtime'] as const)('accepts %s', (render) => {
    const result = resolvePlutoDocsOptions({ render }, { cmsEnabled: true })
    expect(result.render).toBe(render)
    expect(result.errors).toEqual([])
  })

  it('falls back to hybrid with one error for a bad value', () => {
    const result = resolvePlutoDocsOptions(
      { render: 'live' as never },
      { cmsEnabled: true }
    )
    expect(result.render).toBe('hybrid')
    expect(result.errors).toHaveLength(1)
  })

  it('is build when the CMS is off', () => {
    expect(
      resolvePlutoDocsOptions({ render: 'runtime' }, { cmsEnabled: false })
        .render
    ).toBe('build')
  })
})

describe('runtimeMaxAge option', () => {
  it('is 10 seconds by default', () => {
    expect(
      resolvePlutoDocsOptions({}, { cmsEnabled: true }).runtimeMaxAge
    ).toBe(10)
  })

  it('accepts 0 and a whole number', () => {
    expect(
      resolvePlutoDocsOptions({ runtimeMaxAge: 0 }, { cmsEnabled: true })
        .runtimeMaxAge
    ).toBe(0)
    expect(
      resolvePlutoDocsOptions({ runtimeMaxAge: 30 }, { cmsEnabled: true })
        .runtimeMaxAge
    ).toBe(30)
  })

  it.each([-1, 1.5, '10', Number.NaN])(
    'uses the default with one error for %s',
    (value) => {
      const result = resolvePlutoDocsOptions(
        { runtimeMaxAge: value as never },
        { cmsEnabled: true }
      )
      expect(result.runtimeMaxAge).toBe(10)
      expect(result.errors).toHaveLength(1)
    }
  )
})
