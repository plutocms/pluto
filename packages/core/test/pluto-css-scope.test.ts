import { describe, expect, it } from 'vitest'
import { scopeCss } from '../modules/pluto-css/scope'

const roots = ['[data-a]', '[data-s]']
const IN = ':is([data-a], [data-s], [data-a] *, [data-s] *)'
const scope = (css: string) => scopeCss(css, roots).replace(/\s+/g, ' ').trim()

describe('scopeCss', () => {
  it('scopes a utility on its subject', () => {
    expect(scope('.flex { display: flex }')).toBe(
      `.flex${IN} { display: flex }`
    )
  })

  it('scopes each selector of a list', () => {
    expect(scope('.a, .b > .c { color: red }')).toBe(
      `.a${IN}, .b > .c${IN} { color: red }`
    )
  })

  it('puts the scope before a pseudo-element', () => {
    expect(scope('.a::before, .b:hover::after, .c:after { content: "" }')).toBe(
      `.a${IN}::before, .b:hover${IN}::after, .c${IN}:after { content: "" }`
    )
  })

  it('turns :root, :host, and html into the roots', () => {
    expect(scope(':root, :host { --x: 1 }')).toBe(
      '[data-a], [data-s], [data-a], [data-s] { --x: 1 }'
    )
    expect(scope('html { line-height: 1.5 }')).toBe(
      '[data-a], [data-s] { line-height: 1.5 }'
    )
  })

  it('keeps a selector that names a root', () => {
    expect(scope('[data-s] h1 { margin: 0 }')).toBe('[data-s] h1 { margin: 0 }')
    expect(scope(':root[data-a] body { margin: 0 }')).toBe(
      ':root[data-a] body { margin: 0 }'
    )
  })

  it('scopes a rule inside @layer and @media, not a nested rule or keyframes', () => {
    const css = [
      '@layer utilities { .sm\\:flex { @media (width >= 40rem) { display: flex } } }',
      '.hover\\:x { &:hover { color: red } }',
      '@keyframes spin { from { rotate: 0 } to { rotate: 1turn } }',
    ].join('\n')

    expect(scope(css)).toBe(
      [
        `@layer utilities { .sm\\:flex${IN} { @media (width >= 40rem) { display: flex } } }`,
        `.hover\\:x${IN} { &:hover { color: red } }`,
        '@keyframes spin { from { rotate: 0 } to { rotate: 1turn } }',
      ].join(' ')
    )
  })

  it('scopes the universal selector of the reset', () => {
    expect(scope('*, ::after, ::before { box-sizing: border-box }')).toBe(
      `*${IN}, ${IN}::after, ${IN}::before { box-sizing: border-box }`
    )
  })
})
