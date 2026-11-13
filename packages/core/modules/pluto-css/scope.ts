import type { AtRule, Rule } from 'postcss'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

export const PLUTO_ADMIN_SCOPE_ROOTS = [
  '[data-pluto-admin]',
  '[data-pluto-admin-scope]',
] as const

const ROOT_SELECTORS = new Set([':root', ':host', 'html'])

const PSEUDO_ELEMENT = /^(?:::|:(?:before|after|first-line|first-letter)$)/

function scopeSelectorList(selector: string, roots: readonly string[]): string {
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
        out.push(...roots.map((root) => `${root}${root}`))
        return
      }
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
