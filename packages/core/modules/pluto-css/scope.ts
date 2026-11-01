// Scopes a compiled stylesheet to the Pluto admin: every rule matches only
// inside a scope root. Pure (no `nuxt/kit`), so the unit tests call it directly.
// See the single-tailwind-build skill, "The isolated build".
import type { AtRule, Rule } from 'postcss'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

/**
 * The elements that start the admin scope: <html> on an admin page
 * (`data-pluto-admin`), and the admin bar and its portals on a public page
 * (`data-pluto-admin-scope`).
 */
export const PLUTO_ADMIN_SCOPE_ROOTS = [
  '[data-pluto-admin]',
  '[data-pluto-admin-scope]',
] as const

/** Selectors that mean the document root. They become the scope roots. */
const ROOT_SELECTORS = new Set([':root', ':host', 'html'])

/** A pseudo-element: the scope goes before it. */
const PSEUDO_ELEMENT = /^(?:::|:(?:before|after|first-line|first-letter)$)/

/** Scopes each selector of a selector list. */
function scopeSelectorList(selector: string, roots: readonly string[]): string {
  // An element in the scope: a root itself, or anything inside a root.
  const inScope = `:is(${[...roots, ...roots.map((root) => `${root} *`)].join(', ')})`
  const rootNames = roots.map((root) => root.slice(1, -1))
  const out: string[] = []

  selectorParser((list) => {
    list.each((sel) => {
      const text = sel.toString().trim()
      if (rootNames.some((name) => text.includes(name))) {
        out.push(text)
        return
      }
      if (ROOT_SELECTORS.has(text)) {
        out.push(...roots)
        return
      }
      // The subject is the last compound: `.a .b::before` becomes
      // `.a .b:is(…)::before`.
      const nodes = sel.nodes
      let start = 0
      nodes.forEach((node, index) => {
        if (node.type === 'combinator') {
          start = index + 1
        }
      })
      const pseudoElement = nodes.findIndex(
        (node, index) =>
          index >= start &&
          node.type === 'pseudo' &&
          PSEUDO_ELEMENT.test(node.value)
      )
      const scope = selectorParser.pseudo({ value: inScope })
      if (pseudoElement === -1) {
        sel.append(scope)
      } else {
        // The space before the pseudo-element (`, ::after`) moves to the
        // scope. Left in place, it would be a descendant combinator.
        const target = nodes[pseudoElement]!
        scope.spaces.before = target.spaces.before
        target.spaces.before = ''
        sel.insertBefore(target, scope)
      }
      out.push(sel.toString().trim())
    })
  }).processSync(selector)

  return out.join(', ')
}

/** True when the rule is in `@keyframes`, or nested in another rule. */
function keepAsIs(rule: Rule): boolean {
  let parent = rule.parent
  while (parent && parent.type !== 'root') {
    if (parent.type === 'rule') {
      return true
    }
    if (
      parent.type === 'atrule' &&
      /keyframes$/i.test((parent as AtRule).name)
    ) {
      return true
    }
    parent = parent.parent
  }
  return false
}

/**
 * Returns `css` with every top-level rule scoped to `roots`:
 *
 * - `:root`, `:host`, and `html` become the roots, so the theme variables and
 *   the base of the document apply from each root down.
 * - Any other selector gets `:is(<root>, <root> *)` on its subject. It then
 *   matches only in the scope, with (0,1,0) more specificity.
 * - A selector that names a root already stays.
 * - Rules nested in rules (they follow their parent) and `@keyframes` stay.
 */
export function scopeCss(
  css: string,
  roots: readonly string[] = PLUTO_ADMIN_SCOPE_ROOTS
): string {
  const ast = postcss.parse(css)
  ast.walkRules((rule) => {
    if (!keepAsIs(rule)) {
      rule.selector = scopeSelectorList(rule.selector, roots)
    }
  })
  return ast.toString()
}
