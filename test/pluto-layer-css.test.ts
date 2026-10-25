import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, '..', 'app', 'assets', 'css', 'pluto-layer.css'), 'utf8')

describe('pluto-layer.css header tokens', () => {
  it('sets the admin bar height and keeps the Nuxt UI header height on :root', () => {
    const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''

    expect(root).toContain('--pluto-admin-bar-height: 2.5rem;')
    expect(root).toContain('--ui-header-height: 2.5rem;')
  })

  it('has the admin navbar and the admin layout read the bar token', () => {
    const navbar = readFileSync(join(__dirname, '..', 'app', 'components', 'Pluto', 'Navbar', 'PlutoNavbarAdmin.vue'), 'utf8')
    const layout = readFileSync(join(__dirname, '..', 'app', 'layouts', 'admin.vue'), 'utf8')

    expect(navbar).toContain('h-(--pluto-admin-bar-height)')
    expect(layout).toContain('var(--pluto-admin-bar-height)')
  })
})
