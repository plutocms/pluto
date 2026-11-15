import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  blockComponentLoaders,
  componentsModuleSource,
  contentComponentLoaders,
  extraComponentLoaders,
  mergeComponentLoaders,
} from '../modules/pluto-blocks/catalog'

const fixture = join(__dirname, 'fixtures', 'discovery')
const dirs = [
  join(fixture, 'app', 'components', 'content'),
  join(fixture, 'layer', 'components', 'content'),
]

describe('the block components manifest', () => {
  it('has a macro component and a plain component of components/content', () => {
    const names = contentComponentLoaders(dirs).map((loader) => loader.name)
    expect(names).toContain('callout')
    expect(names).toContain('plain')
    expect(names).not.toContain('prose-note')
  })

  it('keeps the public manifest to the components that call the macro', () => {
    const names = blockComponentLoaders(dirs).map((loader) => loader.name)
    expect(names).toContain('callout')
    expect(names).not.toContain('plain')
  })

  it('adds the names of a layer, in kebab or Pascal case, and warns once about unknown names', () => {
    const warnings: string[] = []
    const loaders = extraComponentLoaders(
      ['u-page-hero', 'UButton', 'missing-one', 'missing-two'],
      [
        { pascalName: 'UPageHero', filePath: '/ui/UPageHero.vue' },
        { pascalName: 'UButton', filePath: '/ui/UButton.vue', export: 'Named' },
      ],
      (message) => warnings.push(message)
    )
    expect(loaders.map((loader) => loader.name)).toEqual([
      'u-page-hero',
      'u-button',
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('missing-one, missing-two')
  })

  it('writes one lazy import for each entry, and the first entry of a name wins', () => {
    const source = componentsModuleSource(
      mergeComponentLoaders(
        contentComponentLoaders(dirs),
        [
          { name: 'u-page-hero', file: '/ui/UPageHero.vue' },
          { name: 'plain', file: '/other/Plain.vue' },
          { name: 'u-button', file: '/ui/UButton.vue', exportName: 'Named' },
        ]
      )
    )
    expect(source).toContain('"callout": () => import(')
    expect(source).toContain('"u-page-hero": () => import("/ui/UPageHero.vue"),')
    expect(source).not.toContain('/other/Plain.vue')
    expect(source).toContain(
      '"u-button": () => import("/ui/UButton.vue").then((module) => ({ default: module["Named"] })),'
    )
  })
})
