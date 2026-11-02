import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The 3D components work on a site with no Tailwind: they carry only
// `pluto-*` classes. Their layout is in the components, their look in
// pluto-base.css (`@plutocms/css/base`). See the 3d skill.
const app = join(__dirname, '..', 'app')
const read = (...path: string[]) => readFileSync(join(app, ...path), 'utf8')

/** Every static class token in a template: `class="..."`. */
function templateClasses(sfc: string): string[] {
  const template = /<template>([\s\S]*)<\/template>/.exec(sfc)?.[1] ?? ''
  return [...template.matchAll(/\sclass="([^"]*)"/g)].flatMap((match) =>
    match[1]!.split(/\s+/).filter(Boolean)
  )
}

describe('3D components', () => {
  it.each(['Pluto3dViewer.vue', 'Pluto3dPreview.vue'])(
    '%s has only pluto-* classes',
    (file) => {
      const classes = templateClasses(read('components', file))

      expect(classes.length).toBeGreaterThan(0)
      expect(classes.filter((token) => !token.startsWith('pluto-'))).toEqual([])
    }
  )

  it('styles every badge and icon class in pluto-base.css', () => {
    const css = read('assets', 'css', 'pluto-base.css')
    const used = new Set(
      ['Pluto3dViewer.vue', 'Pluto3dPreview.vue']
        .flatMap((file) => templateClasses(read('components', file)))
        .filter((token) => /^pluto-3d-(?:badge|icon|muted)/.test(token))
    )

    for (const token of used) {
      expect(css, token).toContain(`.${token})`)
    }
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/@(import|apply|theme|utility|source|tailwind)\b/)
  })
})
