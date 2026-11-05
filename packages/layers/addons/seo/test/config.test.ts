import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(
    /^\s*\/\/.*$/gm,
    ''
  )

describe('the seo add-on', () => {
  it('does not extend core, so an app loads core once (through its backend layer)', () => {
    expect(read('../nuxt.config.ts')).not.toMatch(/extends:/)
  })

  it('names itself seo, the namespace of its texts', () => {
    expect(read('../nuxt.config.ts')).toContain("name: 'seo'")
  })

  it('has an optional peer dependency on core 0.57 and newer', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    )
    expect(pkg.name).toBe('@plutocms/seo')
    expect(pkg.peerDependencies['@plutocms/core']).toBe('>=0.57.0 <1.0.0')
    expect(pkg.peerDependenciesMeta['@plutocms/core'].optional).toBe(true)
  })

  it('turns the post type on and the whole site indexable by default', () => {
    const config = read('../app/app.config.ts')
    expect(config).toContain('types: { post: true }')
    expect(config).toContain('indexable: true')
    expect(config).toContain("type: 'post'")
    expect(config).toContain('limit: 20')
  })

  it('has a skill and a FEATURES.md line', () => {
    const features = readFileSync(
      new URL('../FEATURES.md', import.meta.url),
      'utf8'
    )
    expect(features).toContain('.claude/skills/seo/SKILL.md')
    expect(
      readFileSync(
        new URL('../../../../../.claude/skills/seo/SKILL.md', import.meta.url),
        'utf8'
      )
    ).toContain('# SEO add-on')
  })
})
