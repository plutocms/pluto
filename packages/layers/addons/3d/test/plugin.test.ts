import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const config = readFileSync(
  new URL('../nuxt.config.ts', import.meta.url),
  'utf8'
)
const plugin = readFileSync(
  new URL('../app/plugins/pluto-3d.ts', import.meta.url),
  'utf8'
)

describe('the 3D add-on registration', () => {
  it('adds the type of a 3D model to the media library, with its own size limit', () => {
    expect(config).toContain("extraTypes: ['model/gltf-binary']")
    expect(config).toContain("'model/gltf-binary': 25 * 1024 * 1024")
  })

  it('registers the kind with a viewer and a preview, and loads three.js on demand only', () => {
    expect(plugin).toContain("accept: ['model/gltf-binary']")
    expect(plugin).toContain('createPreview')
    expect(plugin).not.toMatch(/^import .*three/m)
  })

  it('does not extend core, so an app loads core once (through its backend layer)', () => {
    const code = config.replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/extends:/)
  })
})
