import { toHtml } from 'hast-util-to-html'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

/**
 * The spans of one code block (`hljs-*` classes), or `null` for a language that lowlight does not
 * know: the next highlighter of the site tries, or the block stays plain. `toHtml` escapes the
 * text.
 *
 * @see https://pluto.vulmix.dev/docs/layers/syntax-lowlight#use-it-with-other-highlighters
 */
export function highlightWithLowlight(block: {
  code: string
  lang: string
}): string | null {
  const lang = block.lang.toLowerCase()
  if (!lang || !lowlight.registered(lang)) {
    return null
  }
  return toHtml(lowlight.highlight(lang, block.code))
}
