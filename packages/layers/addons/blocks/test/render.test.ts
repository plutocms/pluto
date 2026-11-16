import type { Component } from 'vue'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MarkdownDocument } from '@comark/vue'
import { ELEMENT_NODE, parse, TEXT_NODE } from 'ultrahtml'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSSRApp, defineComponent, h, Suspense } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { parsePlutoBlocks } from '../../../core/server/utils/pluto-blocks'
import { coerceNodeProps } from '../../../core/shared/utils/blocks/prop-types'
import { resolveBlockDefinition } from '../../../core/shared/utils/blocks/registry'
import BlockInline from '../app/components/BlockInline.vue'
import { readBlocks } from './helpers'

interface HtmlNode {
  type: number
  name?: string
  value?: string
  attributes?: Record<string, string>
  children?: HtmlNode[]
}

const modules = import.meta.glob<{ default: Component }>(
  '../app/components/content/*.vue',
  { eager: true }
)

const components: Record<string, Component> = {}
for (const [path, module] of Object.entries(modules)) {
  const name = /\/(\w+)\.vue$/.exec(path)![1]!
  components[name.replace(/(?<!^)([A-Z])/g, '-$1').toLowerCase()] =
    module.default
}

const UIcon = defineComponent({
  props: { name: { type: String, default: '' } },
  setup:
    (props, { attrs }) =>
    () =>
      h('span', { 'data-icon': props.name, ...attrs }),
})

const sources = { components: readBlocks() }

async function render(markdown: string): Promise<string> {
  const parsed = await parsePlutoBlocks(markdown)
  const document = {
    ...parsed,
    nodes: coerceNodeProps(parsed.nodes, (tag) =>
      resolveBlockDefinition(tag, { sources })
    ),
  }
  const app = createSSRApp({
    render: () =>
      h(Suspense, null, {
        default: () =>
          h(MarkdownDocument, {
            value: document,
            componentsManifest: (tag: string) =>
              components[tag]
                ? Promise.resolve({
                    __esModule: true,
                    default: components[tag],
                  })
                : undefined,
          }),
      }),
  })
  app.component('UIcon', UIcon)
  app.component('BlockInline', BlockInline)
  return renderToString(app)
}

function elements(node: HtmlNode): HtmlNode[] {
  return (node.children ?? []).flatMap((child) =>
    child.type === ELEMENT_NODE ? [child, ...elements(child)] : []
  )
}

function textOf(node: HtmlNode): string {
  if (node.type === TEXT_NODE) {
    return node.value ?? ''
  }
  return (node.children ?? []).map(textOf).join('')
}

function hasClass(node: HtmlNode, name: string): boolean {
  return (node.attributes?.class ?? '').split(/\s+/).includes(name)
}

function byClass(root: HtmlNode, name: string): HtmlNode[] {
  return elements(root).filter((node) => hasClass(node, name))
}

function child(node: HtmlNode, name: string): HtmlNode[] {
  return (node.children ?? []).filter(
    (item) => item.type === ELEMENT_NODE && hasClass(item, name)
  )
}

function landingBody(): string {
  const file = join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'playground',
    'content',
    'pages',
    'landing.md'
  )
  return readFileSync(file, 'utf8').replace(/^---[\s\S]*?\n---\n/, '')
}

describe('the landing page, rendered on the server through Comark', () => {
  let html = ''
  let page: HtmlNode

  beforeAll(async () => {
    html = await render(landingBody())
    page = parse(html.replace(/<!--.*?-->/gs, '')) as HtmlNode
  }, 30_000)

  it('renders a section with columns and the content of each column', () => {
    const hero = elements(page).find(
      (node) => node.name === 'section' && node.attributes?.id === 'top'
    )!

    expect(hero).toBeDefined()
    expect(hero.attributes!['data-valign']).toBe('center')
    expect(hero.attributes!.style).toContain('min-height:60vh')
    expect(hero.attributes!.style).toContain(
      'padding-block:var(--pluto-blocks-space-2xl)'
    )
    expect(hero.attributes!.style).toContain(
      'url(&quot;/images/landing-hero.svg&quot;)'
    )

    const overlay = byClass(hero, 'pluto-blocks-section__overlay')[0]!
    expect(overlay.attributes!.style).toContain(
      'color-mix(in srgb, #0f172a 55%, transparent)'
    )
    expect(overlay.attributes!['aria-hidden']).toBe('true')

    const inner = child(hero, 'pluto-blocks-section__inner')[0]!
    const columns = child(inner, 'pluto-blocks-columns')[0]!
    expect(columns.attributes!['data-stack']).toBe('md')
    expect(columns.attributes!.style).toContain(
      '--pluto-blocks-gap:var(--pluto-blocks-space-md)'
    )

    const [left, right] = child(columns, 'pluto-blocks-column')
    expect(left!.attributes!.style).toContain(
      '--pluto-blocks-basis:calc(70% - var(--pluto-blocks-gap, 0px) * 0.3)'
    )
    expect(left!.attributes!.style).toContain(
      '--pluto-blocks-basis:calc(70% - var(--pluto-blocks-gap, 0px) * 0.3)'
    )
    expect(right!.attributes!.style).toContain('calc(30% -')
    expect(byClass(left!, 'pluto-blocks-heading')).toHaveLength(1)
    expect(byClass(right!, 'pluto-blocks-icon')).toHaveLength(1)
  })

  it('renders a real h1 for level 1 and an h2 for level 2, with no paragraph inside', () => {
    const headings = elements(page).filter((node) =>
      hasClass(node, 'pluto-blocks-heading')
    )
    const h1 = headings.find((node) => node.name === 'h1')!
    const h2 = headings.find((node) => node.name === 'h2')!

    expect(h1).toBeDefined()
    expect(h1.attributes!['data-size']).toBe('3xl')
    expect(textOf(h1).trim()).toBe('Build a page in minutes')
    expect(elements(h1).filter((node) => node.name === 'p')).toEqual([])

    expect(h2).toBeDefined()
    expect(textOf(h2).trim()).toBe('Everything you need')
    expect(h2.attributes!['data-align']).toBe('center')
    expect(elements(page).filter((node) => node.name === 'h1')).toHaveLength(1)
    expect(html).not.toMatch(/<h[1-6][^>]*>\s*<p/)
  })

  it('renders a button that is a link as an anchor, with a safe rel for a new tab', () => {
    const buttons = elements(page).filter((node) =>
      hasClass(node, 'pluto-blocks-button')
    )
    const start = buttons.find((node) => textOf(node).includes('Get started'))!
    const docs = buttons.find((node) => textOf(node).includes('Read the docs'))!

    expect(start.name).toBe('a')
    expect(start.attributes!.href).toBe('/admin')
    expect(start.attributes!['data-size']).toBe('lg')
    expect(start.attributes!.target).toBeUndefined()
    const icon = elements(start).find((node) => node.name === 'span')!
    expect(icon.attributes!['data-icon']).toBe('i-lucide-rocket')
    expect(icon.attributes!['aria-hidden']).toBe('true')

    expect(docs.name).toBe('a')
    expect(docs.attributes!.href).toBe('https://pluto.vulmix.dev/docs')
    expect(docs.attributes!['data-variant']).toBe('outline')
    expect(docs.attributes!.target).toBe('_blank')
    expect(docs.attributes!.rel).toBe('noopener noreferrer')
    expect(docs.attributes!.style).toContain(
      '--pluto-blocks-button-color:#ffffff'
    )
  })

  it('renders the accordion with details and summary, and one open item', () => {
    const accordion = byClass(page, 'pluto-blocks-accordion')[0]!
    const items = child(accordion, 'pluto-blocks-accordion-item')

    expect(items).toHaveLength(2)
    for (const item of items) {
      expect(item.name).toBe('details')
      const summary = (item.children ?? []).find(
        (node) => node.name === 'summary'
      )!
      expect(summary).toBeDefined()
    }
    expect(textOf(items[0]!)).toContain('Do I need to know how to code?')
    expect(textOf(items[0]!)).toContain('No. Pick a block')
    expect(items[0]!.attributes).toHaveProperty('open')
    expect(items[1]!.attributes).not.toHaveProperty('open')
    expect(items[0]!.attributes!.name).toBeTruthy()
    expect(items[0]!.attributes!.name).toBe(items[1]!.attributes!.name)
    expect(html).not.toContain('<button')
  })

  it('renders a column inside a column, with its own columns and blocks', () => {
    const outer = byClass(page, 'pluto-blocks-column').find(
      (column) => child(column, 'pluto-blocks-columns').length > 0
    )!

    expect(outer).toBeDefined()
    const nested = child(outer, 'pluto-blocks-columns')[0]!
    const columns = child(nested, 'pluto-blocks-column')

    expect(columns).toHaveLength(2)
    expect(textOf(columns[0]!)).toContain('120')
    expect(textOf(columns[0]!)).toContain('Pages built')
    expect(textOf(columns[1]!)).toContain('99')
    expect(byClass(columns[1]!, 'pluto-blocks-counter')).toHaveLength(1)
  })

  it('keeps the alt text of every image', () => {
    const images = elements(page).filter((node) => node.name === 'img')

    expect(images.length).toBeGreaterThanOrEqual(5)
    for (const image of images) {
      expect(image.attributes, image.attributes?.src).toHaveProperty('alt')
    }
    const gallery = byClass(page, 'pluto-blocks-gallery')[0]!
    const alts = elements(gallery)
      .filter((node) => node.name === 'img')
      .map((node) => node.attributes!.alt)
    expect(alts).toEqual([
      'Hello card, first view',
      'A dark gradient',
      'Hello card, second view',
    ])
    const photo = byClass(page, 'pluto-blocks-testimonial__photo')[0]!
    expect(photo.attributes!.alt).toBe('')
  })

  it('renders the other blocks of the kit', () => {
    const features = elements(page).filter((node) =>
      hasClass(node, 'pluto-blocks-icon-box')
    )
    expect(features).toHaveLength(3)
    const title = elements(features[0]!).find((node) => node.name === 'h3')!
    expect(textOf(title)).toBe('Fast')

    const list = byClass(page, 'pluto-blocks-icon-list')[0]!
    expect(list.name).toBe('ul')
    const items = child(list, 'pluto-blocks-icon-list-item')
    expect(items.map((item) => item.name)).toEqual(['li', 'li', 'li'])
    expect(textOf(items[0]!).trim()).toBe('No code to write')
    expect(textOf(items[1]!).trim()).toBe('Sanitized on the server')
    expect(elements(list).filter((node) => node.name === 'p')).toEqual([])
    const link = elements(items[2]!).find((node) => node.name === 'a')!
    expect(link.attributes!.href).toBe('/')

    const divider = byClass(page, 'pluto-blocks-divider')[0]!
    expect(divider.name).toBe('hr')
    expect(divider.attributes!.style).toContain('width:40%')

    const spacer = byClass(page, 'pluto-blocks-spacer')[0]!
    expect(spacer.attributes!['aria-hidden']).toBe('true')

    const imageBox = byClass(page, 'pluto-blocks-image-box')[0]!
    expect(textOf(imageBox)).toContain('Made for editors')

    expect(html).toContain('<youtube-embed')
    expect(html).toContain('jNQXAC9IVRw')

    const quote = byClass(page, 'pluto-blocks-testimonial__quote')[0]!
    expect(quote.name).toBe('blockquote')
    expect(textOf(quote)).toContain('took one afternoon')
    expect(
      textOf(byClass(page, 'pluto-blocks-testimonial__person')[0]!)
    ).toContain('Ana Souza')

    const social = byClass(page, 'pluto-blocks-social-link')
    expect(social).toHaveLength(3)
    const labels = social.map(
      (item) =>
        elements(item).find((node) => node.name === 'a')!.attributes![
          'aria-label'
        ]
    )
    expect(labels).toEqual(['GitHub', 'Pluto website', 'RSS'])

    const text = byClass(page, 'pluto-blocks-text')[0]!
    expect(elements(text).some((node) => node.name === 'strong')).toBe(true)
  })

  it('renders no script and no inline handler', () => {
    expect(html).not.toContain('<script')
    expect(html).not.toMatch(/\son[a-z]+=/)
  })
})

describe('the safety of the props', () => {
  it('drops a link with an unsafe URL, and a bad color', async () => {
    const html = await render(
      [
        '::block-button{label="Bad" link="javascript:alert(1)"}',
        '::',
        '',
        '::block-heading{level="2" color="red; } x {"}',
        'Title',
        '::',
      ].join('\n')
    )

    expect(html).not.toContain('javascript:')
    expect(html).toContain('<button')
    expect(html).not.toContain('} x {')
  })

  it('falls back to h2 for a level that is not from 1 to 6', async () => {
    const html = await render('::block-heading{level="9"}\nTitle\n::')

    expect(html).toContain('<h2')
    expect(html).not.toContain('<h9')
  })

  it('renders a video that no provider knows as a link', async () => {
    const html = await render(
      '::block-video{url="https://example.com/movie" title="A movie"}\n::'
    )

    expect(html).toContain('<a href="https://example.com/movie"')
    expect(html).toContain('A movie')
  })
})

describe('the MDC that the skill tells an importer to write', () => {
  it('takes a single-quoted value, a false boolean and a kebab case prop', async () => {
    const html = await render(
      [
        ':::block-columns{:wrap="false" stack="never"}',
        "::block-column{width='50'}",
        '::block-accordion-item{title=\'Say "hi" now\'}',
        'Answer',
        '::',
        '::',
        ':::',
        '',
        '::block-section{min-height="40vh" overlay-opacity="20" overlay="black"}',
        '::',
      ].join('\n')
    )
    const page = parse(html.replace(/<!--.*?-->/gs, '')) as HtmlNode
    const columns = byClass(page, 'pluto-blocks-columns')[0]!
    const section = elements(page).find((node) => node.name === 'section')!

    expect(columns.attributes!['data-wrap']).toBe('false')
    expect(columns.attributes!['data-stack']).toBe('never')
    expect(textOf(page)).toContain('Say &quot;hi&quot; now')
    expect(section.attributes!.style).toContain('min-height:40vh')
    expect(html).toContain('color-mix(in srgb, black 20%, transparent)')
  })
})
