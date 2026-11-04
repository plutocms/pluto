import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

// The public components work on a site with no Tailwind: they carry only
// `pluto-*` classes, and their look is plain CSS in pluto-base.css. See the
// public-components skill.
const app = join(__dirname, '..', 'app')
const read = (...path: string[]) => readFileSync(join(app, ...path), 'utf8')

/** Every static class token in a template: `class="..."`. */
function templateClasses(sfc: string): string[] {
  const template = /<template>([\s\S]*)<\/template>/.exec(sfc)?.[1] ?? ''
  return [...template.matchAll(/\sclass="([^"]*)"/g)].flatMap((match) =>
    match[1]!.split(/\s+/).filter(Boolean)
  )
}

describe('public components', () => {
  it.each([['Pluto', 'PlutoHtml.vue'], ['ColorModeButton.vue']])(
    '%s has only pluto-* classes',
    (...path) => {
      const sfc = read('components', ...path)
      const classes = templateClasses(sfc)

      expect(classes.length).toBeGreaterThan(0)
      expect(classes.filter((token) => !token.startsWith('pluto-'))).toEqual([])
      expect(sfc).not.toContain('#build/ui/')
    }
  )
})

describe('pluto-base.css', () => {
  const css = read('assets', 'css', 'pluto-base.css')

  it('has no Tailwind directive', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/@(import|apply|theme|utility|source|tailwind)\b/)
  })

  it('puts every rule in the components layer, with zero specificity', () => {
    const root = postcss.parse(css)
    const rules: string[] = []
    root.walkRules((rule) => {
      const parent = rule.parent
      expect(
        parent?.type === 'atrule' && (parent as postcss.AtRule).params
      ).toBe('components')
      rules.push(...rule.selectors)
    })

    expect(rules.length).toBeGreaterThan(0)
    // Only `:where(...)`, pseudo-elements, and combinators: nothing counts.
    for (const selector of rules) {
      const rest = selector
        .replace(/:where\([^()]*\)/g, '')
        .replace(/::[a-z-]+/g, '')
      expect(rest, selector).toMatch(/^[\s>+~]*$/)
    }
  })
})
