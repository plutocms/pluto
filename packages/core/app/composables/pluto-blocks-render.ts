import type { MarkdownDocument } from 'comark'
import type { Component } from 'vue'
import type { PlutoPreviewRenderOptions } from './pluto-content-preview'
import { pascalCase } from 'comark/utils'
import { blockKey } from '#layers/pluto/shared/utils/blocks/definition'
import { coerceNodeProps } from '#layers/pluto/shared/utils/blocks/prop-types'
import { resolveBlockDefinition } from '#layers/pluto/shared/utils/blocks/registry'
import componentBlocks from '#pluto-blocks'
import contentComponents from '#pluto-content-components'

const PROSE_TAGS = [
  'p',
  'a',
  'blockquote',
  'code',
  'pre',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'ul',
  'ol',
  'li',
  'strong',
  'table',
  'thead',
  'tbody',
  'td',
  'th',
  'tr',
  'script',
]

/**
 * What a render of blocks needs, for the preview of the editor and for `PlutoBlocks`: the site
 * components (`components/content/` and the names of the `pluto:blocks:components` hook), the
 * conversion of the props to the types of the block definitions, and the map of tags to
 * components. Both renders use it, so the editor shows what the site shows.
 */
export function usePlutoBlocksRender(
  options: MaybeRefOrGetter<PlutoPreviewRenderOptions> = {}
) {
  const sources = usePlutoBlockSources(componentBlocks)
  const vueApp = useNuxtApp().vueApp

  function manifest(tag: string) {
    return contentComponents[blockKey(tag)]?.()
  }

  function coerce(document: MarkdownDocument): MarkdownDocument {
    return {
      ...document,
      nodes: coerceNodeProps(document.nodes, (tag) =>
        resolveBlockDefinition(tag, { sources: sources() })
      ),
    }
  }

  const components = computed(() => {
    const render = toValue(options)
    const map: Record<string, Component | string> = {}
    for (const [tag, name] of Object.entries(render.components ?? {})) {
      const component = vueApp.component(pascalCase(name))
      if (component) {
        map[tag] = component
      }
    }
    if (render.prose === false) {
      for (const tag of PROSE_TAGS) {
        if (!(tag in map)) {
          map[`Prose${pascalCase(tag)}`] = tag
        }
      }
    }
    return map
  })

  return { manifest, coerce, components }
}
